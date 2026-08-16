import { describe, it, expect } from "vitest";
import { computeTopMaterials } from "@/lib/stats-top-materials";
import type { Period, PeriodStockItem } from "@/types";

function makeStockItem(materialId: number, name: string, snapshot: number, archived = false): PeriodStockItem {
  return {
    id: materialId, periodId: 1, stockItemId: materialId, dayPriceSnapshot: snapshot,
    setupCostSnapshot: 0, discountPct: null, discountAmount: null, bundleBookingId: null,
    stockItem: {
      id: materialId, materialId, unitNumber: 1, identifier: null, notes: null, costPrice: null,
      material: {
        id: materialId, name, category: null, categoryId: null, code: `CODE-${materialId}`, notes: null,
        dayPrice: snapshot, setupCost: null, isBundle: false, bundlePriceOverride: null,
        archived, costPrice: null, listPrice: null, revenueBefore: null,
      },
    },
  };
}

function makePeriod(materials: PeriodStockItem[]): Period {
  return { id: 1, projectId: 1, name: "Test", startDate: "2026-06-01", endDate: "2026-06-01", materials, people: [], bundleBookings: [] };
}

describe("computeTopMaterials (K1.1)", () => {
  it("ranks materials by revenue, highest first", () => {
    const period = makePeriod([
      makeStockItem(1, "Tent", 50),
      makeStockItem(2, "Frigo", 200),
    ]);
    const top = computeTopMaterials([period]);
    expect(top[0].name).toBe("Frigo");
    expect(top[0].revenue).toBe(200);
    expect(top[1].name).toBe("Tent");
  });

  it("excludes archived materials (M1.3's rule)", () => {
    const period = makePeriod([makeStockItem(1, "Oude flightcase", 1000, true)]);
    expect(computeTopMaterials([period])).toEqual([]);
  });

  it("accumulates the same material's revenue across periods", () => {
    const a = makePeriod([makeStockItem(1, "Tent", 50)]);
    const b = makePeriod([makeStockItem(1, "Tent", 50)]);
    const top = computeTopMaterials([a, b]);
    expect(top[0].revenue).toBe(100);
  });

  it("caps at the top 10", () => {
    const items = Array.from({ length: 12 }, (_, i) => makeStockItem(i + 1, `Item ${i}`, i + 1));
    const period = makePeriod(items);
    expect(computeTopMaterials([period])).toHaveLength(10);
  });
});
