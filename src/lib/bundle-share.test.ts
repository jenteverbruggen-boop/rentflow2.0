import { describe, it, expect } from "vitest";
import { computeSubhireStats } from "@/lib/stats-subhire";
import { computeMaterialPayback } from "@/lib/payback";
import { componentShare, missingUnits, shareOfUnits, unitsNeeded } from "@/lib/bundle-share";
import type { Period, PeriodBundleBooking, PeriodMaterialShortage, PeriodStockItem } from "@/types";

// A set sold at €20/day for 2 days (€40) with a table (weight 3 × 1) and
// chairs (weight 2 × 4 = 8 of 11): the chairs are 8/11 of the line.
const weights = [
  { bundleBookingId: 1, materialId: 1, quantity: 1, dayPriceAtBooking: 3 },
  { bundleBookingId: 1, materialId: 2, quantity: 4, dayPriceAtBooking: 2 },
];
const booking = { id: 1, quantity: 1, dayPriceSnapshot: 20 };
const DAYS = 2;

const hired = (quantity: number, over: Partial<PeriodMaterialShortage> = {}): PeriodMaterialShortage =>
  ({
    id: 9, periodId: 1, materialId: 2, quantity, bundleBookingId: 1, dayPriceSnapshot: 0, setupCostSnapshot: 0,
    discountPct: null, discountAmount: null, supplierId: 7, subhireCostBasis: "per_huur", subhireUnitCost: 1,
    subhireCostOverride: null, material: { id: 2, name: "Stoel" }, ...over,
  }) as PeriodMaterialShortage;

describe("bundle-share (D2)", () => {
  it("splits the set line pro-rata by the booked weights, and the shares sum to the line", () => {
    const table = componentShare(booking, weights, 1, DAYS);
    const chairs = componentShare(booking, weights, 2, DAYS);
    expect(table + chairs).toBeCloseTo(40, 6);
    expect(chairs).toBeCloseTo((40 * 8) / 11, 6);
    expect(componentShare(booking, weights, 99, DAYS)).toBe(0);
  });

  it("units needed and the share of some units", () => {
    expect(unitsNeeded(booking, weights, 2)).toBe(4);
    expect(shareOfUnits(booking, weights, 2, DAYS, 2)).toBeCloseTo((40 * 8) / 11 / 2, 6);
  });

  it("counts hired and open rows alike as missing", () => {
    expect(missingUnits([hired(1), hired(1, { supplierId: null }), hired(5, { materialId: 1 })], 1, 2)).toBe(2);
  });
});

function periodWith(shortages: PeriodMaterialShortage[], materials: PeriodStockItem[] = []): Period {
  const bookingRow = { ...booking, periodId: 1, materialId: 50, components: weights.map((w, i) => ({ id: i + 1, ...w })) } as PeriodBundleBooking;
  return {
    id: 1, projectId: 1, name: "P", startDate: "2026-06-01", endDate: "2026-06-02", updatedAt: "x",
    materials, people: [], bundleBookings: [bookingRow], shortages,
  } as unknown as Period;
}

describe("hired set components in margin and payback (D2)", () => {
  it("2 of 4 chairs hired: revenue is half the chairs' share, cost counts in full", () => {
    const stats = computeSubhireStats([periodWith([hired(2)])]);
    expect(stats.revenue).toBeCloseTo(((40 * 8) / 11) / 2, 1);
    expect(stats.cost).toBe(2);
    expect(stats.margin).toBeCloseTo(stats.revenue - 2, 2);
    expect(stats.componentCost).toBe(2);
    expect(stats.rows).toBe(1);
  });

  it("all hired units' shares plus the owned remainder add up to the set line", () => {
    const hiredShare = computeSubhireStats([periodWith([hired(2)])]).revenue;
    const chairsShare = componentShare(booking, weights, 2, DAYS);
    expect(hiredShare + chairsShare / 2).toBeCloseTo(chairsShare, 1);
  });

  const chair = (id: number): PeriodStockItem =>
    ({
      id, periodId: 1, stockItemId: id, dayPriceSnapshot: 0, setupCostSnapshot: 0, discountPct: null, discountAmount: null,
      bundleBookingId: 1, shippedAt: null, returnedAt: null,
      stockItem: { id, materialId: 2, unitNumber: id, identifier: null, notes: null, costPrice: null, material: { id: 2, name: "Stoel" } },
    }) as unknown as PeriodStockItem;

  it("payback of the owned chairs halves when 2 of 4 units are hired", () => {
    const material = { id: 2, name: "Stoel", code: null, archived: false, costPrice: 100, revenueBefore: null };
    const owned = [chair(1), chair(2)];
    const full = computeMaterialPayback(material, [{ materialId: 2, costPrice: null }], [periodWith([], [chair(1), chair(2), chair(3), chair(4)])], weights);
    const half = computeMaterialPayback(material, [{ materialId: 2, costPrice: null }], [periodWith([hired(2)], owned)], weights);
    expect(full?.earned).toBeCloseTo((40 * 8) / 11, 1);
    expect(half?.earned).toBeCloseTo(((40 * 8) / 11) / 2, 1);
  });

  it("open (unfilled) units also take their share away from owned stock", () => {
    const material = { id: 2, name: "Stoel", code: null, archived: false, costPrice: 100, revenueBefore: null };
    const result = computeMaterialPayback(material, [{ materialId: 2, costPrice: null }], [periodWith([hired(4, { supplierId: null })])], weights);
    expect(result?.earned).toBe(0);
  });
});
