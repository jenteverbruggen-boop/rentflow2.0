import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, unauthorized, badRequest, conflict, notFound, serverError } from "@/lib/api-auth";
import { effectiveMaterialPrice } from "@/lib/effective-price";
import { bookFlatMaterial, bookBundleMaterial } from "@/lib/booking";
import { toNumber, toNumberOrNull } from "@/lib/serialize";

interface BookedAssignment {
  dayPriceSnapshot: unknown;
  setupCostSnapshot: unknown;
  discountPct: unknown;
  discountAmount: unknown;
  stockItem: {
    material: {
      dayPrice: unknown;
      setupCost: unknown;
      bundlePriceOverride: unknown;
    };
  };
}

function serializeAssignment(a: BookedAssignment) {
  return {
    ...a,
    dayPriceSnapshot: toNumber(a.dayPriceSnapshot),
    setupCostSnapshot: toNumberOrNull(a.setupCostSnapshot),
    discountPct: toNumberOrNull(a.discountPct),
    discountAmount: toNumberOrNull(a.discountAmount),
    stockItem: {
      ...a.stockItem,
      material: {
        ...a.stockItem.material,
        dayPrice: toNumber(a.stockItem.material.dayPrice),
        setupCost: toNumberOrNull(a.stockItem.material.setupCost),
        bundlePriceOverride: toNumberOrNull(
          a.stockItem.material.bundlePriceOverride,
        ),
      },
    },
  };
}

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const user = await requireAuth().catch(() => null);
  if (!user) return unauthorized();

  try {
    const { id } = await params;
    const periodId = parseInt(id);
    const { materialId, quantity, discountPct, discountAmount } = await req.json();
    const qty = Math.max(1, parseInt(quantity) || 0);
    if (!materialId || !qty) return badRequest("materialId en quantity zijn verplicht");

    const period = await prisma.period.findUnique({ where: { id: periodId } });
    if (!period) return notFound();

    const material = await prisma.material.findUnique({
      where: { id: parseInt(materialId) },
      include: { components: { include: { child: { include: { stockItems: true } } } } },
    });
    if (!material) return notFound();

    if (material.isBundle) {
      if (material.components.length === 0) return badRequest("Bundle heeft geen componenten");
      const componentSum = material.components.reduce(
        (acc, c) => acc + toNumber(c.child.dayPrice) * c.quantity, 0,
      );
      const dayPriceSnapshot = material.bundlePriceOverride != null
        ? toNumber(material.bundlePriceOverride) : componentSum;
      try {
        const result = await bookBundleMaterial({
          periodId, materialId: material.id, quantity: qty,
          from: period.startDate, to: period.endDate, dayPriceSnapshot,
          components: material.components.map((c) => ({ childId: c.childId, quantity: c.quantity })),
        });
        return NextResponse.json({
          ...result,
          bundleBooking: {
            ...(result.bundleBooking as { dayPriceSnapshot: unknown }),
            dayPriceSnapshot: toNumber(
              (result.bundleBooking as { dayPriceSnapshot: unknown })
                .dayPriceSnapshot,
            ),
          },
        });
      } catch (e: unknown) {
        const err = e as { code?: string; message?: string };
        if (err.code === "UNAVAIL") return conflict(err.message ?? "Onvoldoende voorraad");
        if (err.code === "P2002") return conflict("Conflict bij gelijktijdige boeking — probeer opnieuw");
        return serverError(err.message ?? "Onbekende fout");
      }
    }

    const snapshotPrice = await effectiveMaterialPrice(period.projectId, parseInt(materialId));
    const setupSnapshot = toNumber(material.setupCost ?? 0);
    try {
      const result = await bookFlatMaterial({
        periodId, materialId: material.id, quantity: qty,
        from: period.startDate, to: period.endDate,
        dayPriceSnapshot: snapshotPrice, setupCostSnapshot: setupSnapshot,
        discountPct: discountPct != null ? toNumber(discountPct) : null,
        discountAmount: discountAmount != null ? toNumber(discountAmount) : null,
      });
      return NextResponse.json({
        ...result,
        assignments: (result.assignments as BookedAssignment[]).map(
          serializeAssignment,
        ),
      });
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
