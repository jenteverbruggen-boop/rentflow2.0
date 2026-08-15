import type { Material, PeriodBundleBooking, PeriodStockItem } from "@/types";
import { lineCost } from "@/lib/pricing";
import { toNumber } from "@/lib/serialize";

export interface MaterialGroup {
  key: string;
  material: Material;
  units: number;
  dayPriceSnapshot: number | null;
  discountPct: number | null;
  discountAmount: number | null;
  assignments: PeriodStockItem[];
}

export interface NestedCategoryGroup {
  category: string;
  flatLines: MaterialGroup[];
  bundleLines: BundleLine[];
}

export interface BundleLine {
  booking: PeriodBundleBooking;
  componentGroups: MaterialGroup[];
}

export interface MaterialGroup {
  key: string;
  material: Material;
  units: number;
  dayPriceSnapshot: number | null;
  discountPct: number | null;
  discountAmount: number | null;
  assignments: PeriodStockItem[];
}

function groupKey(a: PeriodStockItem): string {
  return [
    a.stockItem.materialId,
    a.dayPriceSnapshot,
    a.discountPct ?? "x",
    a.discountAmount ?? "x",
  ].join("|");
}

export function groupMaterialAssignments(
  materials: PeriodStockItem[],
): MaterialGroup[] {
  const map = new Map<string, MaterialGroup>();
  for (const a of materials) {
    const k = groupKey(a);
    const existing = map.get(k);
    if (existing) {
      existing.units += 1;
      existing.assignments.push(a);
    } else {
      map.set(k, {
        key: k,
        material: a.stockItem.material,
        units: 1,
        dayPriceSnapshot: a.dayPriceSnapshot,
        discountPct: a.discountPct,
        discountAmount: a.discountAmount,
        assignments: [a],
      });
    }
  }
  return Array.from(map.values()).sort((a, b) =>
    a.material.name.localeCompare(b.material.name),
  );
}

export function groupMaterialAssignmentsNested(
  materials: PeriodStockItem[],
  bundleBookings: PeriodBundleBooking[],
): NestedCategoryGroup[] {
  const flatItems = materials.filter((m) => !m.bundleBookingId);
  const bundleItemsByBookingId = new Map<number, PeriodStockItem[]>();
  for (const m of materials) {
    if (m.bundleBookingId != null) {
      if (!bundleItemsByBookingId.has(m.bundleBookingId))
        bundleItemsByBookingId.set(m.bundleBookingId, []);
      bundleItemsByBookingId.get(m.bundleBookingId)!.push(m);
    }
  }

  const allGroups = groupMaterialAssignments(flatItems);
  const bundleLines: BundleLine[] = bundleBookings.map((b) => ({
    booking: b,
    componentGroups: groupMaterialAssignments(
      bundleItemsByBookingId.get(b.id) ?? [],
    ),
  }));

  const catMap = new Map<string, NestedCategoryGroup>();
  const getCat = (name: string) => {
    if (!catMap.has(name))
      catMap.set(name, { category: name, flatLines: [], bundleLines: [] });
    return catMap.get(name)!;
  };

  for (const g of allGroups) {
    const cat = g.material.categoryRel?.name ?? g.material.category ?? "Overig";
    getCat(cat).flatLines.push(g);
  }
  for (const b of bundleLines) {
    const cat =
      b.booking.material?.categoryRel?.name ??
      b.booking.material?.category ??
      "Overig";
    getCat(cat).bundleLines.push(b);
  }

  return Array.from(catMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([, v]) => v);
}

/**
 * Cost of a grouped material line: per-unit rental (with discount) × units,
 * plus each assignment's own setup/teardown cost summed once (not
 * multiplied by units or days). Shared by cost-line-row.tsx and
 * period-bookings.tsx so neither reimplements the arithmetic by hand —
 * that duplication was the actual €1500 bug (Y1.4).
 */
export function materialGroupCost(group: MaterialGroup, days: number): number {
  const perUnit = lineCost(group.dayPriceSnapshot, days, group);
  const setup = group.assignments.reduce(
    (s, a) => s + toNumber(a.setupCostSnapshot),
    0,
  );
  return Math.round((perUnit * group.units + setup) * 100) / 100;
}
