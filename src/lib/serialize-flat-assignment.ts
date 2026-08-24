import { toNumber, toNumberOrNull } from "@/lib/serialize";

/** Split out of periods/[id]/materials/route.ts to make room for the
 * overboeken branching added there — pure move, no behaviour change. */
export interface BookedAssignment {
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

export function serializeAssignment(a: BookedAssignment) {
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
