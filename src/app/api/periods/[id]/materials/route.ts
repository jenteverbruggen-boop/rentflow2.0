import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModule, forbidden, badRequest, conflict, notFound, serverError } from "@/lib/api-auth";
import { effectiveMaterialPrice } from "@/lib/effective-price";
import { bookFlatMaterial, freeStockItemIds } from "@/lib/booking";
import { bookBundleMaterial } from "@/lib/bundle-booking";
import { bundleAvailableCount } from "@/lib/availability";
import { canOverbook } from "@/lib/material-shortage";
import { moneyWritable } from "@/lib/redact";
import { resolveBookingHires } from "@/lib/booking-hire";
import type { SubhireRequest } from "@/lib/subhire-defaults";
import { toNumber } from "@/lib/serialize";
import type { PriceBasis } from "@/types";
import { redactMoney } from "@/lib/redact";
import { setDayPrice } from "@/lib/set-price";
import {
  serializeAssignment,
  type BookedAssignment,
} from "@/lib/serialize-flat-assignment";

type Params = { params: Promise<{ id: string }> };

// Only the `subhire` block is validated strictly (it feeds supplier cost rows);
// the rest of the body keeps its lenient parsing below.
const subhireSchema = z.object({
  supplierId: z.number().int().positive(),
  basis: z.enum(["per_huur", "per_dag"]).optional(),
  unitCost: z.number().min(0).nullable().optional(),
  costOverride: z.number().min(0).nullable().optional(),
});

export async function POST(req: NextRequest, { params }: Params) {
  const access = await requireModule("planning", "wijzigen").catch(() => null);
  if (!access) return forbidden();

  try {
    const { id } = await params;
    const periodId = parseInt(id);
    const { materialId, quantity, discountPct, discountAmount, allowOverbook, subhire } = await req.json();
    const parsedHire = subhire == null ? null : subhireSchema.safeParse(subhire);
    if (parsedHire && !parsedHire.success) return badRequest(parsedHire.error.issues[0]?.message ?? "Ongeldige inhuur");
    const subhireRequest: SubhireRequest | undefined = parsedHire?.data;
    const qty = Math.max(1, parseInt(quantity) || 0);
    if (!materialId || !qty) return badRequest("materialId en quantity zijn verplicht");

    const period = await prisma.period.findUnique({
      where: { id: periodId },
      include: { project: { select: { status: true } } },
    });
    if (!period) return notFound();
    // Overboeken (K-series) — only concept/geannuleerd projects may ever
    // exceed real stock; `allowOverbook` from the client is only ever
    // honoured when the project's own status allows it.
    const overbookable = canOverbook(period.project.status);
    const wantsOverbook = overbookable && allowOverbook === true;

    const material = await prisma.material.findUnique({
      where: { id: parseInt(materialId) },
      include: { components: { include: { child: { include: { stockItems: true } } } } },
    });
    if (!material) return notFound();
    // M1.3 — an archived material must be refused for booking, not
    // merely hidden from the catalogue and availability lists.
    if (material.archived) return badRequest("Dit materiaal is gearchiveerd en kan niet geboekt worden");

    const { hires, error: hireError } = await resolveBookingHires(prisma, material, subhireRequest, moneyWritable(access));
    if (hireError) return badRequest(hireError);
    const { flatHire, componentHire, hiresIn } = hires;

    if (material.isBundle) {
      if (material.components.length === 0) return badRequest("Bundle heeft geen componenten");
      if (overbookable && !wantsOverbook && !hiresIn) {
        const available = await bundleAvailableCount(material.id, { from: period.startDate, to: period.endDate });
        if (qty > available) {
          return NextResponse.json(
            { error: "Onvoldoende voorraad", shortfall: { requested: qty, available } },
            { status: 409 },
          );
        }
      }
      const dayPriceSnapshot = setDayPrice(material.bundlePriceOverride, material.components);
      try {
        const result = await bookBundleMaterial({
          periodId, materialId: material.id, quantity: qty,
          from: period.startDate, to: period.endDate, dayPriceSnapshot,
          allowOverbook: wantsOverbook,
          components: material.components.map((c) => ({
            childId: c.childId,
            childName: c.child.name,
            quantity: c.quantity,
            dayPrice: toNumber(c.child.dayPrice),
            subhire: componentHire.get(c.childId) ?? null,
          })),
        });
        return NextResponse.json(
          redactMoney(
            {
              ...result,
              bundleBooking: {
                ...(result.bundleBooking as { dayPriceSnapshot: unknown }),
                dayPriceSnapshot: toNumber(
                  (result.bundleBooking as { dayPriceSnapshot: unknown })
                    .dayPriceSnapshot,
                ),
              },
            },
            access,
          ),
        );
      } catch (e: unknown) {
        const err = e as { code?: string; message?: string; shortfall?: unknown };
        if (err.code === "UNAVAIL") {
          return NextResponse.json({ error: err.message ?? "Onvoldoende voorraad", shortfall: err.shortfall }, { status: 409 });
        }
        if (err.code === "P2002") return conflict("Conflict bij gelijktijdige boeking — probeer opnieuw");
        return serverError(err.message ?? "Onbekende fout");
      }
    }

    if (overbookable && !wantsOverbook && !hiresIn) {
      const free = await freeStockItemIds(prisma, material.id, period.startDate, period.endDate);
      if (qty > free.length) {
        return NextResponse.json(
          { error: "Onvoldoende voorraad", shortfall: { requested: qty, available: free.length } },
          { status: 409 },
        );
      }
    }

    const price = await effectiveMaterialPrice(period.projectId, parseInt(materialId));
    const snapshotPrice = price.amount;
    const setupSnapshot = toNumber(material.setupCost ?? 0);
    try {
      const result = await bookFlatMaterial({
        periodId, materialId: material.id, materialName: material.name, quantity: qty,
        from: period.startDate, to: period.endDate,
        dayPriceSnapshot: snapshotPrice, priceBasis: material.priceBasis as PriceBasis, setupCostSnapshot: setupSnapshot,
        discountPct: discountPct != null ? toNumber(discountPct) : null,
        discountAmount: discountAmount != null ? toNumber(discountAmount) : null,
        allowOverbook: wantsOverbook,
        subhire: flatHire,
      });
      return NextResponse.json(
        redactMoney(
          {
            ...result,
            assignments: (result.assignments as BookedAssignment[]).map(
              serializeAssignment,
            ),
          },
          access,
        ),
      );
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string };
      if (err.code === "UNAVAIL") return conflict(err.message ?? "Niet genoeg vrij");
      if (err.code === "P2002") return conflict("Conflict bij gelijktijdige boeking — probeer opnieuw");
      return serverError(err.message ?? "Onbekende fout");
    }
  } catch (err) {
    return serverError((err as Error).message);
  }
}
