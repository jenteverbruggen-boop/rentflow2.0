import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, unauthorized, badRequest, conflict, notFound, serverError } from "@/lib/api-auth";
import { findAvailableStockItems, checkStockItemSameProject } from "@/lib/availability";
import { effectiveMaterialPrice } from "@/lib/effective-price";

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

    const material = await prisma.material.findUnique({ where: { id: parseInt(materialId) } });
    if (!material) return notFound();
    const snapshotPrice = await effectiveMaterialPrice(period.projectId, parseInt(materialId));

    const { available } = await findAvailableStockItems(parseInt(materialId), {
      from: period.startDate,
      to: period.endDate,
    });

    if (available.length < qty) {
      return conflict(
        `Niet genoeg vrij. Gevraagd: ${qty}, beschikbaar in deze periode: ${available.length}`
      );
    }

    const chosen = available.slice(0, qty);
    const { warnings } = await checkStockItemSameProject(
      chosen.map((c) => c.id),
      {
        from: period.startDate,
        to: period.endDate,
        excludePeriodId: periodId,
        sameProjectId: period.projectId,
      }
    );

    const created = await prisma.$transaction(
      chosen.map((c) =>
        prisma.periodStockItem.create({
          data: {
            periodId,
            stockItemId: c.id,
            dayPriceSnapshot: snapshotPrice,
            discountPct: discountPct != null ? Number(discountPct) : null,
            discountAmount: discountAmount != null ? Number(discountAmount) : null,
          },
          include: { stockItem: { include: { material: true } } },
        })
      )
    );

    return NextResponse.json({ assignments: created, warnings });
  } catch (err) {
    return serverError((err as Error).message);
  }
}
