import { groupMaterialAssignments, materialGroupCost } from "@/lib/grouping";
import { periodDays } from "@/lib/pricing";
import type { Period } from "@/types";

export interface TopMaterialEntry {
  materialId: number;
  name: string;
  code: string | null;
  revenue: number;
}

/**
 * K1.1 — flat material revenue only (bundle pro-rata attribution is
 * K4's own job, a distinct feature). Uses `groupMaterialAssignments`
 * directly on each period's `materials` — every bundled component's
 * `PeriodStockItem` row is snapshotted at `dayPriceSnapshot: 0`
 * (booking.ts), so it contributes nothing here regardless, without
 * needing the `!bundleBookingId` filter K4 requires for its own
 * flat-vs-bundle split. Archived materials are excluded (M1.3's rule,
 * applied consistently to every stats ranking). Returns the top 10,
 * highest revenue first.
 */
export function computeTopMaterials(periods: Period[]): TopMaterialEntry[] {
  const revenueByMaterial = new Map<number, TopMaterialEntry>();

  for (const period of periods) {
    const days = periodDays(period);
    for (const group of groupMaterialAssignments(period.materials)) {
      if (group.material.archived) continue;
      const revenue = materialGroupCost(group, days);
      const existing = revenueByMaterial.get(group.material.id);
      if (existing) existing.revenue += revenue;
      else {
        revenueByMaterial.set(group.material.id, {
          materialId: group.material.id,
          name: group.material.name,
          code: group.material.code,
          revenue,
        });
      }
    }
  }

  return [...revenueByMaterial.values()]
    .map((m) => ({ ...m, revenue: Math.round(m.revenue * 100) / 100 }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);
}
