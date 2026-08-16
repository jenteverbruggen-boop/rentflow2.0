import { describe, it, expect } from "vitest";
import { computeMaterialPayback, rankMaterialPayback, type PaybackMaterial } from "@/lib/payback";
import type { Period, PeriodStockItem, PeriodBundleBooking, Material } from "@/types";

function makeMaterial(id: number, overrides: Partial<PaybackMaterial> = {}): PaybackMaterial {
  return { id, name: `Material ${id}`, code: null, archived: false, costPrice: null, revenueBefore: null, ...overrides };
}

function makeMaterialShape(id: number, name: string): Material {
  return {
    id, name, category: null, categoryId: null, code: null, notes: null, dayPrice: 0,
    setupCost: null, isBundle: false, bundlePriceOverride: null, archived: false,
    costPrice: null, listPrice: null, revenueBefore: null,
  };
}

function makeFlatItem(materialId: number, materialName: string, snapshot: number): PeriodStockItem {
  return {
    id: materialId, periodId: 1, stockItemId: materialId, dayPriceSnapshot: snapshot,
    setupCostSnapshot: 0, discountPct: null, discountAmount: null, bundleBookingId: null, shippedAt: null, returnedAt: null,
    stockItem: { id: materialId, materialId, unitNumber: 1, identifier: null, notes: null, costPrice: null, material: makeMaterialShape(materialId, materialName) },
  };
}

function makeBundleComponentItem(id: number, materialId: number, materialName: string, bundleBookingId: number): PeriodStockItem {
  return {
    id, periodId: 1, stockItemId: id, dayPriceSnapshot: 0, setupCostSnapshot: 0,
    discountPct: null, discountAmount: null, bundleBookingId, shippedAt: null, returnedAt: null,
    stockItem: { id, materialId, unitNumber: 1, identifier: null, notes: null, costPrice: null, material: makeMaterialShape(materialId, materialName) },
  };
}

function makePeriod(opts: {
  materials?: PeriodStockItem[]; bundleBookings?: PeriodBundleBooking[]; start?: string; end?: string;
}): Period {
  return {
    id: 1, projectId: 1, name: "Test",
    startDate: opts.start ?? "2026-06-01", endDate: opts.end ?? "2026-06-01",
    updatedAt: opts.start ?? "2026-06-01",
    materials: opts.materials ?? [], people: [], bundleBookings: opts.bundleBookings ?? [],
  };
}

describe("computeMaterialPayback (K4.1)", () => {
  it("cost price 300 + €330 of flat bookings → 110%", () => {
    const material = makeMaterial(1, { costPrice: 300 });
    const stockItems = [{ materialId: 1, costPrice: null }]; // one owned unit, falls back to material.costPrice
    const period = makePeriod({ materials: [makeFlatItem(1, "Fridge", 330)] });
    const result = computeMaterialPayback(material, stockItems, [period], []);
    expect(result?.earned).toBe(330);
    expect(result?.costBasis).toBe(300);
    expect(result?.paybackPct).toBe(110);
  });

  it("no cost price anywhere → excluded, never shown at 0%", () => {
    const material = makeMaterial(1, { costPrice: null });
    const period = makePeriod({ materials: [makeFlatItem(1, "Fridge", 330)] });
    expect(computeMaterialPayback(material, [], [period], [])).toBeNull();
  });

  it("archived materials are always excluded", () => {
    const material = makeMaterial(1, { costPrice: 300, archived: true });
    expect(computeMaterialPayback(material, [], [], [])).toBeNull();
  });

  it("per-unit StockItem.costPrice overrides falls back to material.costPrice only when unset", () => {
    const material = makeMaterial(1, { costPrice: 100 });
    const stockItems = [{ materialId: 1, costPrice: 50 }, { materialId: 1, costPrice: null }];
    const result = computeMaterialPayback(material, stockItems, [], []);
    expect(result?.costBasis).toBe(150); // 50 (own) + 100 (falls back to material.costPrice)
  });

  it("a material rented only inside a set accrues its pro-rata share, never €0 (Q48's cocktailtafel example)", () => {
    const table = makeMaterial(1, { name: "Cocktailtafel", costPrice: 50 });
    const booking: PeriodBundleBooking = { id: 1, periodId: 1, materialId: 99, quantity: 1, dayPriceSnapshot: 8 };
    const period = makePeriod({
      materials: [makeBundleComponentItem(10, 1, "Cocktailtafel", 1), makeBundleComponentItem(11, 2, "Hoes", 1)],
      bundleBookings: [booking],
    });
    const weights = [
      { bundleBookingId: 1, materialId: 1, quantity: 1, dayPriceAtBooking: 5 },
      { bundleBookingId: 1, materialId: 2, quantity: 1, dayPriceAtBooking: 3 },
    ];
    const result = computeMaterialPayback(table, [], [period], weights);
    expect(result?.earned).toBe(5); // 8 * 5/8 = 5, not €0
  });

  it("a €0-weight component (e.g. 'aciet' in Tap + aciet) correctly earns nothing", () => {
    const aciet = makeMaterial(3, { name: "Aciet", costPrice: 10 });
    const booking: PeriodBundleBooking = { id: 2, periodId: 1, materialId: 98, quantity: 1, dayPriceSnapshot: 75 };
    const period = makePeriod({
      materials: [makeBundleComponentItem(20, 3, "Aciet", 2), makeBundleComponentItem(21, 4, "Tap", 2)],
      bundleBookings: [booking],
    });
    const weights = [
      { bundleBookingId: 2, materialId: 3, quantity: 1, dayPriceAtBooking: 0 },
      { bundleBookingId: 2, materialId: 4, quantity: 1, dayPriceAtBooking: 75 },
    ];
    const result = computeMaterialPayback(aciet, [], [period], weights);
    expect(result?.earned).toBe(0);
  });

  it("all-weights-zero splits the bundle revenue equally, never dividing by zero", () => {
    const a = makeMaterial(5, { name: "A", costPrice: 10 });
    const booking: PeriodBundleBooking = { id: 3, periodId: 1, materialId: 97, quantity: 1, dayPriceSnapshot: 20 };
    const period = makePeriod({
      materials: [makeBundleComponentItem(30, 5, "A", 3), makeBundleComponentItem(31, 6, "B", 3)],
      bundleBookings: [booking],
    });
    const weights = [
      { bundleBookingId: 3, materialId: 5, quantity: 1, dayPriceAtBooking: 0 },
      { bundleBookingId: 3, materialId: 6, quantity: 1, dayPriceAtBooking: 0 },
    ];
    const result = computeMaterialPayback(a, [], [period], weights);
    expect(result?.earned).toBe(10); // 20 split equally across 2 components
  });

  it("no double counting: a material both flat-booked and set-booked in the same period sums both, never one from the other", () => {
    const table = makeMaterial(1, { name: "Cocktailtafel", costPrice: 50 });
    const booking: PeriodBundleBooking = { id: 1, periodId: 1, materialId: 99, quantity: 1, dayPriceSnapshot: 8 };
    const period = makePeriod({
      materials: [
        makeFlatItem(1, "Cocktailtafel", 5), // one flat-booked unit
        makeBundleComponentItem(10, 1, "Cocktailtafel", 1), // one unit inside a set
        makeBundleComponentItem(11, 2, "Hoes", 1),
      ],
      bundleBookings: [booking],
    });
    const weights = [
      { bundleBookingId: 1, materialId: 1, quantity: 1, dayPriceAtBooking: 5 },
      { bundleBookingId: 1, materialId: 2, quantity: 1, dayPriceAtBooking: 3 },
    ];
    const result = computeMaterialPayback(table, [], [period], weights);
    expect(result?.earned).toBe(10); // 5 (flat) + 5 (bundle share) — not 5, not 15
  });

  it("ignores the date range by definition — a material's payback is lifetime-to-date", () => {
    // No date-range parameter exists on the function signature at all;
    // this test documents that as the contract, not a runtime check.
    expect(computeMaterialPayback).toHaveLength(4);
  });
});

describe("rankMaterialPayback (K4.2)", () => {
  it("ranks by paybackPct descending, excludes materials with no cost price", () => {
    const good = makeMaterial(1, { name: "Good", costPrice: 100 });
    const bad = makeMaterial(2, { name: "Bad", costPrice: 100 });
    const unknown = makeMaterial(3, { name: "Unknown", costPrice: null });
    const periods = [
      makePeriod({ materials: [makeFlatItem(1, "Good", 200)] }), // 200%
      makePeriod({ materials: [makeFlatItem(2, "Bad", 10)] }), // 10%
    ];
    const { best, worst } = rankMaterialPayback([good, bad, unknown], [], periods, []);
    expect(best[0].name).toBe("Good");
    expect(worst[0].name).toBe("Bad");
    expect(best.find((r) => r.name === "Unknown")).toBeUndefined();
  });
});
