import type { BundleStock, BundleStockComponentInput } from "@/types";

export function computeBundleStock(
  components: BundleStockComponentInput[],
): BundleStock {
  if (components.length === 0) {
    return { completeSets: 0, hasIncomplete: false, componentSum: 0, components: [] };
  }

  const completeSets = components.reduce((min, c) => {
    const buildable = c.needPerSet > 0 ? Math.floor(c.totalStock / c.needPerSet) : 0;
    return Math.min(min, buildable);
  }, Infinity);

  const componentSum = components.reduce(
    (sum, c) => sum + c.dayPrice * c.needPerSet,
    0,
  );

  const rows = components.map((c) => {
    const usedInComplete = completeSets * c.needPerSet;
    const remaining = c.totalStock - usedInComplete;
    const haveForNext = Math.min(remaining, c.needPerSet);
    const missingForNext = Math.max(0, c.needPerSet - remaining);
    return { ...c, usedInComplete, remaining, haveForNext, missingForNext };
  });

  return {
    completeSets,
    hasIncomplete: rows.some((r) => r.remaining > 0),
    componentSum,
    components: rows,
  };
}
