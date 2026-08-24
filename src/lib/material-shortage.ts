import type { PeriodMaterialShortage } from "@/types";
import type { MaterialGroup } from "@/lib/grouping";
import { lineCost } from "@/lib/pricing";
import { toNumber } from "@/lib/serialize";

/** Overboeken — statuses in which a period is allowed to want more units
 * of a material than physically exist as stock (see PeriodMaterialShortage). */
export const OVERBOOK_STATUSES = ["concept", "geannuleerd"] as const;

export function canOverbook(status: string): boolean {
  return (OVERBOOK_STATUSES as readonly string[]).includes(status);
}

function shortageGroupKey(s: PeriodMaterialShortage): string {
  return [
    s.materialId,
    s.dayPriceSnapshot,
    s.discountPct ?? "x",
    s.discountAmount ?? "x",
  ].join("|");
}

/**
 * Folds flat (non-bundle) shortage rows into the matching `MaterialGroup`
 * — same key as `groupMaterialAssignments` uses for real assignments — or
 * synthesises a standalone group when nothing matches (e.g. the material
 * has zero real stock at all). Does not mutate its inputs; component
 * shortages (`bundleBookingId != null`) are skipped here since the
 * bundle's own quantity already carries the price.
 */
export function mergeShortagesIntoGroups(
  groups: MaterialGroup[],
  shortages: PeriodMaterialShortage[],
): MaterialGroup[] {
  const result = groups.map((g) => ({
    ...g,
    overbookedUnits: g.overbookedUnits ?? 0,
    overbookedSetup: g.overbookedSetup ?? 0,
    shortageIds: [...(g.shortageIds ?? [])],
  }));
  const byKey = new Map(result.map((g) => [g.key, g]));

  for (const s of shortages) {
    if (s.bundleBookingId != null) continue;
    const key = shortageGroupKey(s);
    const existing = byKey.get(key);
    const setupAdd = toNumber(s.setupCostSnapshot) * s.quantity;
    if (existing) {
      existing.units += s.quantity;
      existing.overbookedUnits += s.quantity;
      existing.overbookedSetup += setupAdd;
      existing.shortageIds.push(s.id);
    } else {
      const synthesized: MaterialGroup = {
        key,
        material: s.material,
        units: s.quantity,
        dayPriceSnapshot: s.dayPriceSnapshot,
        discountPct: s.discountPct,
        discountAmount: s.discountAmount,
        assignments: [],
        overbookedUnits: s.quantity,
        overbookedSetup: setupAdd,
        shortageIds: [s.id],
      };
      byKey.set(key, synthesized);
      result.push(synthesized);
    }
  }

  return result.sort((a, b) => a.material.name.localeCompare(b.material.name));
}

/**
 * Cost of the flat (non-bundle) shortage rows, same per-unit arithmetic as
 * `materialGroupCost` (rental with discount, plus setup cost once per
 * unit). Component shortages contribute 0 — the bundle's own
 * `dayPriceSnapshot` already prices the full requested quantity.
 */
export function shortageCost(
  shortages: PeriodMaterialShortage[],
  days: number,
): number {
  const total = shortages
    .filter((s) => s.bundleBookingId == null)
    .reduce((acc, s) => {
      const rental = lineCost(s.dayPriceSnapshot, days, s) * s.quantity;
      const setup = toNumber(s.setupCostSnapshot) * s.quantity;
      return acc + rental + setup;
    }, 0);
  return Math.round(total * 100) / 100;
}
