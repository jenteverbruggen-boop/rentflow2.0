import { groupMaterialAssignments, materialGroupCost } from "@/lib/grouping";
import { periodDays } from "@/lib/pricing";
import { addToSplit, bucketOf, emptySplit, roundSplit, type BucketedPeriod, type Split } from "@/lib/stats-status";

export interface TopMaterialEntry {
  materialId: number;
  name: string;
  code: string | null;
  /** Booked revenue per bucket; the ranking uses `agreed`. */
  revenue: Split;
}

/**
 * K1.1 — flat material revenue only (bundle pro-rata attribution is
 * K4's own job, a distinct feature). Uses `groupMaterialAssignments`
 * directly on each period's `materials` — every bundled component's
 * `PeriodStockItem` row is snapshotted at `dayPriceSnapshot: 0`
 * (booking.ts), so it contributes nothing here regardless, without
 * needing the `!bundleBookingId` filter K4 requires for its own
 * flat-vs-bundle split. Overbooked and hired-in units count too — they are
 * billed like owned ones. Archived materials are excluded (M1.3's rule,
 * applied consistently to every stats ranking). Returns the top 10,
 * highest revenue first.
 */
export function computeTopMaterials(periods: BucketedPeriod[]): TopMaterialEntry[] {
  const revenueByMaterial = new Map<number, TopMaterialEntry>();

  for (const period of periods) {
    const days = periodDays(period);
    for (const group of groupMaterialAssignments(period.materials, period.shortages ?? [])) {
      if (group.material.archived) continue;
      const revenue = materialGroupCost(group, days);
      const entry = revenueByMaterial.get(group.material.id) ?? {
        materialId: group.material.id,
        name: group.material.name,
        code: group.material.code,
        revenue: emptySplit(),
      };
      addToSplit(entry.revenue, bucketOf(period), revenue);
      revenueByMaterial.set(group.material.id, entry);
    }
  }

  return [...revenueByMaterial.values()]
    .map((m) => ({ ...m, revenue: roundSplit(m.revenue) }))
    .sort((a, b) => b.revenue.agreed - a.revenue.agreed || b.revenue.pending - a.revenue.pending)
    .slice(0, 10);
}
