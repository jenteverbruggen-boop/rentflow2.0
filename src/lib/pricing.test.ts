import { describe, it, expect } from "vitest";
import {
  periodDays,
  lineCost,
  materialLineCost,
  personLineCost,
  periodTotal,
  periodPeopleCost,
  periodMaterialsCost,
  periodTravelCost,
  periodSubtotal,
  projectCostSummary,
} from "@/lib/pricing";
import type {
  Period,
  PeriodStockItem,
  PeriodPerson,
  PeriodMaterialShortage,
} from "@/types";

function makeStockItem(
  snapshot: number,
  opts?: {
    discountPct?: number;
    discountAmount?: number;
    bundleBookingId?: number;
    setupCostSnapshot?: number;
  },
): PeriodStockItem {
  return {
    id: 1,
    periodId: 1,
    stockItemId: 1,
    dayPriceSnapshot: snapshot,
    setupCostSnapshot: opts?.setupCostSnapshot ?? 0,
    discountPct: opts?.discountPct ?? null,
    discountAmount: opts?.discountAmount ?? null,
    bundleBookingId: opts?.bundleBookingId ?? null,
    shippedAt: null,
    returnedAt: null,
    stockItem: {
      id: 1,
      materialId: 1,
      unitNumber: 1,
      identifier: null,
      notes: null,
      costPrice: null,
      material: {
        id: 1,
        name: "Test",
        category: null,
        categoryId: null,
        code: null,
        notes: null,
        dayPrice: snapshot,
        setupCost: null,
        isBundle: false,
        bundlePriceOverride: null,
        archived: false,
        costPrice: null,
        listPrice: null,
        revenueBefore: null,
      },
    },
  };
}

function makePerson(
  snapshot: number,
  opts?: {
    discountPct?: number;
    discountAmount?: number;
    travelCosts?: { unitCost: number; quantity: number }[];
    billingUnit?: "dag" | "uur";
    rateSnapshot?: number | null;
    startAt?: string | null;
    endAt?: string | null;
    days?: { startAt: string; endAt: string }[];
  },
): PeriodPerson {
  return {
    id: 1,
    periodId: 1,
    personId: 1,
    functionId: null,
    startAt: opts?.startAt ?? null,
    endAt: opts?.endAt ?? null,
    days: (opts?.days ?? []).map((d, i) => ({
      id: i + 1,
      periodPersonId: 1,
      startAt: d.startAt,
      endAt: d.endAt,
    })),
    overlapAck: false,
    billingUnit: opts?.billingUnit ?? "dag",
    rateSnapshot: opts?.rateSnapshot ?? null,
    dayPriceSnapshot: snapshot,
    discountPct: opts?.discountPct ?? null,
    discountAmount: opts?.discountAmount ?? null,
    travelCosts: (opts?.travelCosts ?? []).map((t, i) => ({
      id: i + 1,
      periodPersonId: 1,
      label: null,
      unitCost: t.unitCost,
      quantity: t.quantity,
    })),
    person: {
      id: 1,
      name: "Test",
      email: null,
      phone: null,
      address: null,
      postalCode: null,
      city: null,
      country: null,
      dayPrice: snapshot,
    },
  };
}

function makeShortage(
  quantity: number,
  opts?: {
    dayPriceSnapshot?: number;
    setupCostSnapshot?: number;
    discountPct?: number;
    discountAmount?: number;
    bundleBookingId?: number;
  },
): PeriodMaterialShortage {
  return {
    id: 1,
    periodId: 1,
    materialId: 1,
    quantity,
    bundleBookingId: opts?.bundleBookingId ?? null,
    dayPriceSnapshot: opts?.dayPriceSnapshot ?? 50,
    setupCostSnapshot: opts?.setupCostSnapshot ?? 0,
    discountPct: opts?.discountPct ?? null,
    discountAmount: opts?.discountAmount ?? null,
    material: {
      id: 1,
      name: "Test",
      category: null,
      categoryId: null,
      code: null,
      notes: null,
      dayPrice: opts?.dayPriceSnapshot ?? 50,
      setupCost: null,
      isBundle: false,
      bundlePriceOverride: null,
      archived: false,
      costPrice: null,
      listPrice: null,
      revenueBefore: null,
    },
  };
}

function makePeriod(
  start: string,
  end: string,
  materials: PeriodStockItem[] = [],
  people: PeriodPerson[] = [],
): Period {
  return {
    id: 1,
    projectId: 1,
    name: "Test",
    startDate: start,
    endDate: end,
    updatedAt: start,
    materials,
    people,
  };
}

describe("periodDays", () => {
  it("same-day period = 1 day", () => {
    expect(periodDays(makePeriod("2026-05-01", "2026-05-01"))).toBe(1);
  });

  it("2-day span = 2 days", () => {
    expect(periodDays(makePeriod("2026-05-01", "2026-05-02"))).toBe(2);
  });

  it("3-day span (date strings) = 3 days", () => {
    expect(periodDays(makePeriod("2026-05-10", "2026-05-12"))).toBe(3);
  });
});

describe("lineCost", () => {
  it("no discount", () => {
    expect(lineCost(100, 3, {})).toBe(300);
  });

  it("percentage discount", () => {
    expect(lineCost(100, 3, { discountPct: 10 })).toBe(270);
  });

  it("flat discount", () => {
    expect(lineCost(100, 3, { discountAmount: 50 })).toBe(250);
  });

  it("never below 0", () => {
    expect(lineCost(10, 1, { discountAmount: 999 })).toBe(0);
  });
});

describe("materialLineCost", () => {
  it("quantity × snapshot × days", () => {
    const line = makeStockItem(50);
    expect(materialLineCost(line, 4)).toBe(200);
  });

  it("adds setup/teardown cost once, not multiplied by days", () => {
    const line = makeStockItem(50, { setupCostSnapshot: 85 });
    expect(materialLineCost(line, 5)).toBe(50 * 5 + 85);
    // same setup regardless of duration
    expect(materialLineCost(makeStockItem(50, { setupCostSnapshot: 85 }), 1)).toBe(
      50 + 85,
    );
  });

  it("setup applies on top of a discounted rental", () => {
    const line = makeStockItem(100, { discountPct: 10, setupCostSnapshot: 20 });
    expect(materialLineCost(line, 2)).toBe(100 * 2 * 0.9 + 20);
  });
});

describe("personLineCost", () => {
  it("snapshot × days", () => {
    const line = makePerson(200);
    expect(personLineCost(line, 3)).toBe(600);
  });

  // H5.3 — hourly billing and the day-rate regression it must not touch.
  it("a 4-hour evening assignment at an hourly rate bills 4 × hour rate", () => {
    const line = makePerson(300, {
      billingUnit: "uur",
      rateSnapshot: 45,
      startAt: "2026-06-01T18:00:00Z",
      endAt: "2026-06-01T22:00:00Z",
    });
    // days (3) is irrelevant on the hourly path — only the window's own
    // hours matter, proving the two billing modes don't leak into each
    // other via the shared `days` argument.
    expect(personLineCost(line, 3)).toBe(180);
  });

  it("billingUnit: uur with no window (Q19 fallback) bills a full day, not zero", () => {
    const line = makePerson(300, { billingUnit: "uur", rateSnapshot: 45 });
    expect(personLineCost(line, 2)).toBe(600);
  });

  it("every existing day-billed figure stays byte-identical (rateSnapshot: null, billingUnit: dag)", () => {
    const line = makePerson(200);
    expect(personLineCost(line, 3)).toBe(600);
    expect(line.billingUnit).toBe("dag");
    expect(line.rateSnapshot).toBeNull();
  });

  it("a mixed period bills each line correctly: one legacy day-billed line, one new hourly line", () => {
    const legacy = makePerson(200);
    const hourly = makePerson(300, {
      billingUnit: "uur",
      rateSnapshot: 45,
      startAt: "2026-06-01T18:00:00Z",
      endAt: "2026-06-01T21:00:00Z",
    });
    expect(personLineCost(legacy, 3)).toBe(600);
    expect(personLineCost(hourly, 3)).toBe(135);
  });
});

describe("periodTotal", () => {
  it("empty period = 0", () => {
    const period = makePeriod("2026-05-01", "2026-05-01");
    expect(periodTotal(period)).toBe(0);
  });

  it("sums materials and people", () => {
    const period = makePeriod(
      "2026-05-01",
      "2026-05-02",
      [makeStockItem(100)],
      [makePerson(200)],
    );
    expect(periodTotal(period)).toBe(600);
  });

  it("bundle booking counted separately, component PeriodStockItem (bundleBookingId set) excluded", () => {
    const flatItem = makeStockItem(100);
    const bundleItem: typeof flatItem = {
      ...makeStockItem(0),
      bundleBookingId: 99,
    };
    const bundleBooking = {
      id: 99,
      periodId: 1,
      materialId: 1,
      quantity: 1,
      dayPriceSnapshot: 50,
    };
    const period = {
      ...makePeriod("2026-05-01", "2026-05-01", [flatItem, bundleItem], []),
      bundleBookings: [bundleBooking],
    };
    expect(periodTotal(period)).toBe(150);
  });
});

describe("B6 cost split", () => {
  it("only-people period", () => {
    const period = makePeriod(
      "2026-05-01",
      "2026-05-01",
      [],
      [makePerson(100)],
    );
    expect(periodPeopleCost(period)).toBe(100);
    expect(periodMaterialsCost(period)).toBe(0);
  });

  it("only-materials period", () => {
    const period = makePeriod(
      "2026-05-01",
      "2026-05-01",
      [makeStockItem(50)],
      [],
    );
    expect(periodPeopleCost(period)).toBe(0);
    expect(periodMaterialsCost(period)).toBe(50);
  });

  it("mixed period sums equal periodTotal", () => {
    const period = makePeriod(
      "2026-05-01",
      "2026-05-02",
      [makeStockItem(100)],
      [makePerson(200)],
    );
    expect(periodPeopleCost(period) + periodMaterialsCost(period)).toBe(
      periodTotal(period),
    );
  });

  it("projectCostSummary totals equal sum of periods", () => {
    const p1 = makePeriod(
      "2026-05-01",
      "2026-05-01",
      [makeStockItem(50)],
      [makePerson(100)],
    );
    const p2 = makePeriod("2026-05-02", "2026-05-02", [], [makePerson(200)]);
    const summary = projectCostSummary([p1, p2]);
    expect(summary.total).toBe(periodTotal(p1) + periodTotal(p2));
    expect(summary.people).toBe(100 + 200);
    expect(summary.materials).toBe(50);
  });
});

describe("periodMaterialsCost — overboeken shortages", () => {
  it("adds a flat shortage's cost on top of real assignments", () => {
    const period = {
      ...makePeriod("2026-05-01", "2026-05-02", [makeStockItem(100)], []),
      shortages: [makeShortage(3, { dayPriceSnapshot: 50 })],
    };
    // real: 100 × 2 days = 200; shortage: 50 × 2 days × 3 units = 300
    expect(periodMaterialsCost(period)).toBe(500);
  });

  it("a bundle-component shortage contributes 0 — the bundle's own price already carries it", () => {
    const period = {
      ...makePeriod("2026-05-01", "2026-05-01", [], []),
      shortages: [
        makeShortage(4, { dayPriceSnapshot: 0, bundleBookingId: 99 }),
      ],
    };
    expect(periodMaterialsCost(period)).toBe(0);
  });
});

describe("string-input coercion (Decimal-as-string from production Postgres)", () => {
  // These simulate what a raw, unconverted Prisma.Decimal.toJSON() value
  // looks like on the wire in production: a numeric string, not a number.
  // CI runs on SQLite (Float), so this is the only test shape that can
  // catch the prod/dev divergence Y1 fixes.

  it("lineCost: string snapshot/discount give identical results to numbers", () => {
    expect(lineCost("100" as unknown as number, 3, {})).toBe(
      lineCost(100, 3, {}),
    );
    expect(
      lineCost("100" as unknown as number, 3, {
        discountPct: "10" as unknown as number,
      }),
    ).toBe(lineCost(100, 3, { discountPct: 10 }));
    expect(
      lineCost("100" as unknown as number, 3, {
        discountAmount: "50" as unknown as number,
      }),
    ).toBe(lineCost(100, 3, { discountAmount: 50 }));
  });

  it("materialLineCost: string dayPriceSnapshot/setupCostSnapshot match number results", () => {
    const numberLine = makeStockItem(50, { setupCostSnapshot: 85 });
    const stringLine: PeriodStockItem = {
      ...numberLine,
      dayPriceSnapshot: "50" as unknown as number,
      setupCostSnapshot: "85" as unknown as number,
    };
    expect(materialLineCost(stringLine, 5)).toBe(materialLineCost(numberLine, 5));
  });

  it('"0" as a string setup cost converts to 0, not NaN', () => {
    const line: PeriodStockItem = {
      ...makeStockItem(50),
      setupCostSnapshot: "0" as unknown as number,
    };
    expect(materialLineCost(line, 2)).toBe(100);
  });

  it("personLineCost: string dayPriceSnapshot matches number result", () => {
    const numberLine = makePerson(200);
    const stringLine: PeriodPerson = {
      ...numberLine,
      dayPriceSnapshot: "200" as unknown as number,
    };
    expect(personLineCost(stringLine, 3)).toBe(personLineCost(numberLine, 3));
  });

  it("periodTravelCost: string unitCost matches number result", () => {
    const numberPerson = makePerson(0, {
      travelCosts: [{ unitCost: 30, quantity: 4 }],
    });
    const stringPerson: PeriodPerson = {
      ...numberPerson,
      travelCosts: (numberPerson.travelCosts ?? []).map((t) => ({
        ...t,
        unitCost: "30" as unknown as number,
      })),
    };
    const numberPeriod = makePeriod("2026-05-01", "2026-05-01", [], [numberPerson]);
    const stringPeriod = makePeriod("2026-05-01", "2026-05-01", [], [stringPerson]);
    expect(periodTravelCost(stringPeriod)).toBe(periodTravelCost(numberPeriod));
  });
});

describe("travel costs", () => {
  it("sums unitCost × quantity across a person's travel lines", () => {
    const person = makePerson(0, {
      travelCosts: [
        { unitCost: 30, quantity: 4 },
        { unitCost: 80, quantity: 2 },
      ],
    });
    const period = makePeriod("2026-05-01", "2026-05-01", [], [person]);
    expect(periodTravelCost(period)).toBe(30 * 4 + 80 * 2);
  });

  it("periodTotal stays travel-inclusive; projectCostSummary also exposes a travel-exclusive subtotal (J1.1, Q22)", () => {
    const person = makePerson(100, {
      travelCosts: [{ unitCost: 50, quantity: 3 }],
    });
    const period = makePeriod("2026-05-01", "2026-05-02", [], [person]);
    // 100 × 2 days + 50 × 3 trips = 350 — periodTotal's arithmetic is
    // unchanged by J1.1; travel still stays inside it per Q22.
    expect(periodTotal(period)).toBe(350);
    expect(periodSubtotal(period)).toBe(200);
    const summary = projectCostSummary([period]);
    expect(summary.travel).toBe(150);
    expect(summary.people).toBe(200);
    expect(summary.subtotal).toBe(200);
    expect(summary.total).toBe(350);
  });
});

// H6 — a person booked for specific days of the period bills those days,
// not the period's length.
describe("personLineCost with selected days (H6)", () => {
  const twoOfFive = [
    { startAt: "2026-06-01T08:00:00Z", endAt: "2026-06-01T17:00:00Z" },
    { startAt: "2026-06-03T08:00:00Z", endAt: "2026-06-03T17:00:00Z" },
  ];

  it("bills the selected days instead of the period's days", () => {
    const line = makePerson(200, { days: twoOfFive });
    expect(personLineCost(line, 5)).toBe(400);
  });

  it("an empty day set keeps billing the whole period — every pre-H6 row is untouched", () => {
    const line = makePerson(200, { days: [] });
    expect(personLineCost(line, 5)).toBe(1000);
  });

  it("a discount applies to the day-selected total, not the period total", () => {
    const line = makePerson(200, { days: twoOfFive, discountPct: 10 });
    expect(personLineCost(line, 5)).toBe(360);
  });

  it("hourly billing sums the hours of every selected day", () => {
    const line = makePerson(300, { billingUnit: "uur", rateSnapshot: 45, days: twoOfFive });
    expect(personLineCost(line, 5)).toBe(18 * 45);
  });

  it("a period total counts a day-selected person by their days", () => {
    // 2026-06-01 .. 2026-06-05 = 5 period days
    const period = makePeriod("2026-06-01", "2026-06-05", [], [
      makePerson(200, { days: twoOfFive }),
      makePerson(100),
    ]);
    // 200 × 2 selected days + 100 × 5 period days
    expect(periodPeopleCost(period)).toBe(400 + 500);
  });
});
