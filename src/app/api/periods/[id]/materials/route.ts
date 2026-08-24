import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModule, forbidden, badRequest, conflict, notFound, serverError } from "@/lib/api-auth";
import { effectiveMaterialPrice } from "@/lib/effective-price";
import { bookFlatMaterial, freeStockItemIds } from "@/lib/booking";
import { bookBundleMaterial } from "@/lib/bundle-booking";
import { bundleAvailableCount } from "@/lib/availability";
import { canOverbook } from "@/lib/material-shortage";
import { toNumber } from "@/lib/serialize";
import { redactMoney } from "@/lib/redact";
import {
  serializeAssignment,
  type BookedAssignment,
} from "@/lib/serialize-flat-assignment";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const access = await requireModule("planning", "wijzigen").catch(() => null);
  if (!access) return forbidden();

  try {
    const { id } = await params;
    const periodId = parseInt(id);
    const { materialId, quantity, discountPct, discountAmount, allowOverbook } = await req.json();
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

    if (material.isBundle) {
      if (material.components.length === 0) return badRequest("Bundle heeft geen componenten");
      if (overbookable && !wantsOverbook) {
        const available = await bundleAvailableCount(material.id, { from: period.startDate, to: period.endDate });
        if (qty > available) {
          return NextResponse.json(
            { error: "Onvoldoende voorraad", shortfall: { requested: qty, available } },
            { status: 409 },
          );
        }
      }
      const componentSum = material.components.reduce(
        (acc, c) => acc + toNumber(c.child.dayPrice) * c.quantity, 0,
      );
      const dayPriceSnapshot = material.bundlePriceOverride != null
        ? toNumber(material.bundlePriceOverride) : componentSum;
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
        const err = e as { code?: string; message?: string };
        if (err.code === "UNAVAIL") return conflict(err.message ?? "Onvoldoende voorraad");
        if (err.code === "P2002") return conflict("Conflict bij gelijktijdige boeking — probeer opnieuw");
        return serverError(err.message ?? "Onbekende fout");
      }
    }

    if (overbookable && !wantsOverbook) {
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
        dayPriceSnapshot: snapshotPrice, setupCostSnapshot: setupSnapshot,
        discountPct: discountPct != null ? toNumber(discountPct) : null,
        discountAmount: discountAmount != null ? toNumber(discountAmount) : null,
        allowOverbook: wantsOverbook,
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
