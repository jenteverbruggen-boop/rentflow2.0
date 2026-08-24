import { describe, it, expect } from "vitest";
import {
  canOverbook,
  mergeShortagesIntoGroups,
  shortageCost,
} from "@/lib/material-shortage";
import {
  groupMaterialAssignments,
  materialGroupCost,
  type MaterialGroup,
} from "@/lib/grouping";
import { periodMaterialsCost } from "@/lib/pricing";
import type {
  Material,
  Period,
  PeriodMaterialShortage,
  PeriodStockItem,
} from "@/types";

function makeMaterial(id: number, name: string): Material {
  return {
    id,
    name,
    category: null,
    categoryId: null,
    code: null,
    notes: null,
    dayPrice: 50,
    setupCost: null,
    isBundle: false,
    bundlePriceOverride: null,
    archived: false,
    costPrice: null,
    listPrice: null,
    revenueBefore: null,
  };
}

function makeGroup(
  key: string,
  material: Material,
  units: number,
  opts?: { dayPriceSnapshot?: number | null; discountPct?: number | null; discountAmount?: number | null },
): MaterialGroup {
  return {
    key,
    material,
    units,
    dayPriceSnapshot: opts?.dayPriceSnapshot ?? 50,
    discountPct: opts?.discountPct ?? null,
    discountAmount: opts?.discountAmount ?? null,
    assignments: [],
    overbookedUnits: 0,
    overbookedSetup: 0,
    shortageIds: [],
  };
}

function makeShortage(
  id: number,
  materialId: number,
  material: Material,
  quantity: number,
  opts?: {
    dayPriceSnapshot?: number;
    setupCostSnapshot?: number;
    discountPct?: number | null;
    discountAmount?: number | null;
    bundleBookingId?: number | null;
  },
): PeriodMaterialShortage {
  return {
    id,
    periodId: 1,
    materialId,
    quantity,
    bundleBookingId: opts?.bundleBookingId ?? null,
    dayPriceSnapshot: opts?.dayPriceSnapshot ?? 50,
    setupCostSnapshot: opts?.setupCostSnapshot ?? 0,
    discountPct: opts?.discountPct ?? null,
    discountAmount: opts?.discountAmount ?? null,
    material,
  };
}

describe("canOverbook", () => {
  it("concept and geannuleerd may overbook", () => {
    expect(canOverbook("concept")).toBe(true);
    expect(canOverbook("geannuleerd")).toBe(true);
  });

  it("bevestigd, actief and afgerond may not", () => {
    expect(canOverbook("bevestigd")).toBe(false);
    expect(canOverbook("actief")).toBe(false);
    expect(canOverbook("afgerond")).toBe(false);
  });
});

describe("mergeShortagesIntoGroups", () => {
  it("folds a shortage into the group with the same key (material/price/discount)", () => {
    const material = makeMaterial(1, "Glas");
    const key = "1|50|x|x";
    const groups = [makeGroup(key, material, 10)];
    const shortages = [makeShortage(1, 1, material, 40, { dayPriceSnapshot: 50 })];

    const merged = mergeShortagesIntoGroups(groups, shortages);

    expect(merged).toHaveLength(1);
    expect(merged[0].units).toBe(50);
    expect(merged[0].overbookedUnits).toBe(40);
    expect(merged[0].shortageIds).toEqual([1]);
  });

  it("synthesises its own group when nothing matches (e.g. zero real stock)", () => {
    const material = makeMaterial(2, "Podium");
    const shortages = [makeShortage(5, 2, material, 12, { dayPriceSnapshot: 30 })];

    const merged = mergeShortagesIntoGroups([], shortages);

    expect(merged).toHaveLength(1);
    expect(merged[0].units).toBe(12);
    expect(merged[0].overbookedUnits).toBe(12);
    expect(merged[0].assignments).toEqual([]);
    expect(merged[0].shortageIds).toEqual([5]);
  });

  it("a different price/discount does not merge into an existing group", () => {
    const material = makeMaterial(1, "Glas");
    const groups = [makeGroup("1|50|x|x", material, 10)];
    const shortages = [makeShortage(2, 1, material, 5, { dayPriceSnapshot: 60 })];

    const merged = mergeShortagesIntoGroups(groups, shortages);

    expect(merged).toHaveLength(2);
    const synthesized = merged.find((g) => g.overbookedUnits > 0);
    expect(synthesized?.units).toBe(5);
  });

  it("skips bundle-component shortage rows (bundleBookingId set)", () => {
    const material = makeMaterial(3, "Statief");
    const shortages = [
      makeShortage(9, 3, material, 4, { bundleBookingId: 77, dayPriceSnapshot: 0 }),
    ];

    const merged = mergeShortagesIntoGroups([], shortages);

    expect(merged).toHaveLength(0);
  });

  it("does not mutate its inputs", () => {
    const material = makeMaterial(1, "Glas");
    const groups = [makeGroup("1|50|x|x", material, 10)];
    const shortages = [makeShortage(1, 1, material, 40)];

    mergeShortagesIntoGroups(groups, shortages);

    expect(groups[0].overbookedUnits).toBe(0);
    expect(groups[0].shortageIds).toEqual([]);
  });
});

describe("shortageCost", () => {
  it("prices flat shortage rows like a real assignment (rental × quantity + setup × quantity)", () => {
    const material = makeMaterial(1, "Glas");
    const shortages = [
      makeShortage(1, 1, material, 3, { dayPriceSnapshot: 50, setupCostSnapshot: 5 }),
    ];
    // rental: 50 × 2 days × 3 units = 300; setup: 5 × 3 = 15
    expect(shortageCost(shortages, 2)).toBe(315);
  });

  it("applies a percentage discount per unit before multiplying by quantity", () => {
    const material = makeMaterial(1, "Glas");
    const shortages = [
      makeShortage(1, 1, material, 2, { dayPriceSnapshot: 100, discountPct: 10 }),
    ];
    // (100 × 1 day × 0.9) × 2 units = 180
    expect(shortageCost(shortages, 1)).toBe(180);
  });

  it("bundle-component shortage rows (bundleBookingId set) contribute 0", () => {
    const material = makeMaterial(3, "Statief");
    const shortages = [
      makeShortage(9, 3, material, 4, { bundleBookingId: 77, dayPriceSnapshot: 0 }),
    ];
    expect(shortageCost(shortages, 5)).toBe(0);
  });

  it("mixes flat and bundle-component rows, only counting the flat one", () => {
    const material = makeMaterial(1, "Glas");
    const flat = makeShortage(1, 1, material, 2, { dayPriceSnapshot: 50 });
    const component = makeShortage(2, 3, material, 4, {
      bundleBookingId: 77,
      dayPriceSnapshot: 0,
    });
    expect(shortageCost([flat, component], 1)).toBe(100);
  });
});

// Y1.4-class regression: materialGroupCost() summed over the grouped lines
// must equal periodMaterialsCost() exactly, whether a shortage merges into
// an existing group (real + phantom units) or has to synthesise its own
// group (zero real stock). setupCostSnapshot is non-zero in both cases so
// the per-unit setup arithmetic in materialGroupCost/overbookedSetup is
// actually exercised, not just the rental math.
describe("group cost reconciles with periodMaterialsCost (task 0 invariant)", () => {
  function makeAssignment(
    id: number,
    material: Material,
    opts: { dayPriceSnapshot: number; setupCostSnapshot: number },
  ): PeriodStockItem {
    return {
      id,
      periodId: 1,
      stockItemId: id,
      dayPriceSnapshot: opts.dayPriceSnapshot,
      setupCostSnapshot: opts.setupCostSnapshot,
      discountPct: null,
      discountAmount: null,
      bundleBookingId: null,
      shippedAt: null,
      returnedAt: null,
      stockItem: {
        id,
        materialId: material.id,
        unitNumber: id,
        identifier: null,
        notes: null,
        costPrice: null,
        material,
      },
    };
  }

  function makePeriod(
    materials: PeriodStockItem[],
    shortages: PeriodMaterialShortage[],
  ): Period {
    return {
      id: 1,
      projectId: 1,
      name: "Periode 1",
      startDate: "2026-01-01",
      endDate: "2026-01-02",
      updatedAt: "2026-01-01",
      materials,
      people: [],
      bundleBookings: [],
      shortages,
    };
  }

  function totalGroupCost(period: Period, days: number): number {
    const groups = groupMaterialAssignments(period.materials, period.shortages);
    return (
      Math.round(
        groups.reduce((s, g) => s + materialGroupCost(g, days), 0) * 100,
      ) / 100
    );
  }

  it("merged case: 10 real assignments + 40 phantom units", () => {
    const material = makeMaterial(1, "Glas");
    const days = 2;
    const assignments = Array.from({ length: 10 }, (_, i) =>
      makeAssignment(i + 1, material, { dayPriceSnapshot: 50, setupCostSnapshot: 5 }),
    );
    const shortages = [
      makeShortage(1, 1, material, 40, { dayPriceSnapshot: 50, setupCostSnapshot: 5 }),
    ];
    const period = makePeriod(assignments, shortages);

    expect(totalGroupCost(period, days)).toBe(periodMaterialsCost(period));
  });

  it("synthesised case: 0 real assignments + 40 phantom units", () => {
    const material = makeMaterial(2, "Podium");
    const days = 2;
    const shortages = [
      makeShortage(5, 2, material, 40, { dayPriceSnapshot: 30, setupCostSnapshot: 5 }),
    ];
    const period = makePeriod([], shortages);

    expect(totalGroupCost(period, days)).toBe(periodMaterialsCost(period));
  });
});
