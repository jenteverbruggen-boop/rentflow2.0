import type { PrismaClient } from "@/generated/prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { lockMaterials, freeStockItemIds } from "@/lib/booking";
import { SubhireError } from "@/lib/subhire";

/**
 * Hired-in → own stock, a manual action: converts (part of) a hired row into
 * owned units when the warehouse has units free for the period. The owned
 * units copy the row's price, setup, discount and set link; the row shrinks
 * or disappears. Never called by `fillShortages` — the supplier may already
 * be ordered, so a person decides. Under the material lock, like every
 * booking write. Returns the supplier so the caller can say "vergeet af te
 * bellen".
 */
export async function takeOwnStockForHire(
  periodId: number,
  shortageId: number,
  quantity: number,
  client: PrismaClient = defaultPrisma,
): Promise<{ converted: number; supplierName: string }> {
  if (!Number.isInteger(quantity) || quantity < 1) throw new SubhireError("BAD_QUANTITY", "Aantal moet minstens 1 zijn");
  return client.$transaction(async (tx) => {
    const txClient = tx as unknown as PrismaClient;
    const peek = await txClient.periodMaterialShortage.findUnique({ where: { id: shortageId } });
    if (!peek || peek.periodId !== periodId) throw new SubhireError("NOT_FOUND", "Inhuur niet gevonden");
    await lockMaterials(txClient, [peek.materialId]);
    const row = await txClient.periodMaterialShortage.findUnique({
      where: { id: shortageId },
      include: { supplier: true, period: true },
    });
    if (!row || row.periodId !== periodId) throw new SubhireError("NOT_FOUND", "Inhuur niet gevonden");
    if (row.supplierId == null) throw new SubhireError("NOT_SUBHIRED", "Dit is niet ingehuurd");

    const free = await freeStockItemIds(txClient, row.materialId, row.period.startDate, row.period.endDate);
    const converted = Math.min(quantity, row.quantity, free.length);
    if (converted < 1) throw new SubhireError("NOTHING_FREE", "Er is geen eigen unit vrij voor deze periode");

    await txClient.periodStockItem.createMany({
      data: free.slice(0, converted).map((stockItemId) => ({
        periodId: row.periodId,
        stockItemId,
        dayPriceSnapshot: row.dayPriceSnapshot,
        priceBasisSnapshot: row.priceBasisSnapshot,
        setupCostSnapshot: row.setupCostSnapshot,
        discountPct: row.discountPct,
        discountAmount: row.discountAmount,
        bundleBookingId: row.bundleBookingId,
      })),
    });
    if (converted >= row.quantity) await txClient.periodMaterialShortage.delete({ where: { id: row.id } });
    else await txClient.periodMaterialShortage.update({ where: { id: row.id }, data: { quantity: row.quantity - converted } });
    return { converted, supplierName: row.supplier?.name ?? "de leverancier" };
  });
}
