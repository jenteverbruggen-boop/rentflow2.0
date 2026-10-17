import type { PrismaClient } from "@/generated/prisma/client";
import { lockMaterials } from "@/lib/booking";
import { createOrIncrementShortage } from "@/lib/shortage-row";
import type { PriceBasis, ProjectReleaseSummary } from "@/types";
import { toNumber, toNumberOrNull } from "@/lib/serialize";

export type ReleaseSummary = ProjectReleaseSummary;

/** Sums `quantity` per identical (material, period[, supplier]) line. */
function sumLines<K extends { material: string; period: string }>(rows: (K & { quantity: number })[]) {
  const map = new Map<string, K & { quantity: number }>();
  for (const r of rows) {
    const { quantity, ...rest } = r;
    const key = JSON.stringify(rest);
    const existing = map.get(key);
    if (existing) existing.quantity += quantity;
    else map.set(key, { ...r, quantity });
  }
  return [...map.values()];
}

/**
 * Cancelling a project frees its stock: every owned unit (PeriodStockItem)
 * becomes an open shortage with the same price, setup, discount and set link,
 * so the quote's contents survive while the units are free for other
 * projects at once. Units shipped and not yet returned stay (they are not in
 * the warehouse). Hired-in rows are left alone and only reported. Runs inside
 * the caller's transaction, under the material lock.
 */
export async function releaseProjectStock(projectId: number, tx: PrismaClient): Promise<ReleaseSummary> {
  const include = { stockItem: { select: { materialId: true, material: { select: { name: true } } } }, period: { select: { name: true } } };
  const peek = await tx.periodStockItem.findMany({
    where: { period: { projectId }, OR: [{ shippedAt: null }, { returnedAt: { not: null } }] },
    select: { stockItem: { select: { materialId: true } } },
  });
  await lockMaterials(tx, peek.map((p) => p.stockItem.materialId));

  const items = await tx.periodStockItem.findMany({ where: { period: { projectId } }, include });
  const out = items.filter((i) => i.shippedAt != null && i.returnedAt == null);
  const free = items.filter((i) => !(i.shippedAt != null && i.returnedAt == null));

  const groups = new Map<string, { first: (typeof free)[number]; quantity: number }>();
  for (const i of free) {
    const snap = { price: toNumber(i.dayPriceSnapshot), basis: i.priceBasisSnapshot, setup: toNumber(i.setupCostSnapshot), pct: toNumberOrNull(i.discountPct), amt: toNumberOrNull(i.discountAmount) };
    const key = JSON.stringify([i.periodId, i.stockItem.materialId, i.bundleBookingId, snap]);
    const g = groups.get(key);
    if (g) g.quantity += 1;
    else groups.set(key, { first: i, quantity: 1 });
  }
  for (const { first, quantity } of groups.values()) {
    await createOrIncrementShortage(tx, {
      periodId: first.periodId,
      materialId: first.stockItem.materialId,
      quantity,
      bundleBookingId: first.bundleBookingId,
      dayPriceSnapshot: toNumber(first.dayPriceSnapshot),
      priceBasis: first.priceBasisSnapshot as PriceBasis,
      setupCostSnapshot: toNumber(first.setupCostSnapshot),
      discountPct: toNumberOrNull(first.discountPct),
      discountAmount: toNumberOrNull(first.discountAmount),
      subhire: null,
    });
  }
  await tx.periodStockItem.deleteMany({ where: { id: { in: free.map((i) => i.id) } } });

  const hiredRows = await tx.periodMaterialShortage.findMany({
    where: { period: { projectId }, supplierId: { not: null } },
    include: { supplier: true, material: true, period: true },
  });
  return {
    released: free.length,
    keptShipped: sumLines(out.map((i) => ({ material: i.stockItem.material.name, period: i.period.name, quantity: 1 }))),
    hired: sumLines(
      hiredRows.map((r) => ({
        supplier: r.supplier?.name ?? "leverancier", material: r.material.name, period: r.period.name, quantity: r.quantity,
      })),
    ),
  };
}
