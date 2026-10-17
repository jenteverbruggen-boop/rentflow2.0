import { describe, it, expect } from "vitest";
import { computeTopMaterials } from "@/lib/stats-top-materials";
import type { Period, PeriodStockItem } from "@/types";

function makeStockItem(materialId: number, name: string, snapshot: number, archived = false): PeriodStockItem {
  return {
    id: materialId, periodId: 1, stockItemId: materialId, dayPriceSnapshot: snapshot,
    setupCostSnapshot: 0, discountPct: null, discountAmount: null, bundleBookingId: null, shippedAt: null, returnedAt: null,
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
  return { id: 1, projectId: 1, name: "Test", startDate: "2026-06-01", endDate: "2026-06-01", updatedAt: "2026-06-01", materials, people: [], bundleBookings: [] };
}

describe("computeTopMaterials (K1.1)", () => {
  it("ranks materials by revenue, highest first", () => {
    const period = makePeriod([
      makeStockItem(1, "Tent", 50),
      makeStockItem(2, "Frigo", 200),
    ]);
    const top = computeTopMaterials([period]);
    expect(top[0].name).toBe("Frigo");
    expect(top[0].revenue).toEqual({ agreed: 200, pending: 0 });
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
    expect(top[0].revenue.agreed).toBe(100);
  });

  it("caps at the top 10", () => {
    const items = Array.from({ length: 12 }, (_, i) => makeStockItem(i + 1, `Item ${i}`, i + 1));
    const period = makePeriod(items);
    expect(computeTopMaterials([period])).toHaveLength(10);
  });
});

describe("computeTopMaterials buckets (D1)", () => {
  it("shows both numbers per material and ranks on the agreed one", () => {
    const pendingBig = { ...makePeriod([makeStockItem(1, "Alleen concept", 900)]), bucket: "teBevestigen" as const };
    const agreedSmall = { ...makePeriod([makeStockItem(2, "Bevestigd", 100)]), bucket: "afgesproken" as const };
    const pendingMore = { ...makePeriod([makeStockItem(2, "Bevestigd", 50)]), bucket: "teBevestigen" as const };
    const top = computeTopMaterials([pendingBig, agreedSmall, pendingMore]);
    expect(top.map((t) => t.name)).toEqual(["Bevestigd", "Alleen concept"]);
    expect(top[0].revenue).toEqual({ agreed: 100, pending: 50 });
    expect(top[1].revenue).toEqual({ agreed: 0, pending: 900 });
  });
});
