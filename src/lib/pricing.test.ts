import { describe, it, expect } from "vitest";
import {
  periodDays,
  lineCost,
  materialLineCost,
  personLineCost,
  periodTotal,
  periodPeopleCost,
  periodMaterialsCost,
  projectCostSummary,
} from "@/lib/pricing";
import type { Period, PeriodStockItem, PeriodPerson } from "@/types";

function makeStockItem(snapshot: number, opts?: { discountPct?: number; discountAmount?: number }): PeriodStockItem {
  return {
    id: 1,
    periodId: 1,
    stockItemId: 1,
    dayPriceSnapshot: snapshot,
    discountPct: opts?.discountPct ?? null,
    discountAmount: opts?.discountAmount ?? null,
    stockItem: { id: 1, materialId: 1, unitNumber: 1, identifier: null, notes: null, material: { id: 1, name: "Test", category: null, categoryId: null, code: null, notes: null, dayPrice: snapshot } },
  };
}

function makePerson(snapshot: number, opts?: { discountPct?: number; discountAmount?: number }): PeriodPerson {
  return {
    id: 1,
    periodId: 1,
    personId: 1,
    role: null,
    dayPriceSnapshot: snapshot,
    discountPct: opts?.discountPct ?? null,
    discountAmount: opts?.discountAmount ?? null,
    person: { id: 1, name: "Test", role: null, email: null, phone: null, address: null, postalCode: null, city: null, country: null, dayPrice: snapshot },
  };
}

function makePeriod(start: string, end: string, materials: PeriodStockItem[] = [], people: PeriodPerson[] = []): Period {
  return { id: 1, projectId: 1, name: "Test", startDate: start, endDate: end, materials, people };
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
});

describe("personLineCost", () => {
  it("snapshot × days", () => {
    const line = makePerson(200);
    expect(personLineCost(line, 3)).toBe(600);
  });
});

describe("periodTotal", () => {
  it("empty period = 0", () => {
    const period = makePeriod("2026-05-01", "2026-05-01");
    expect(periodTotal(period)).toBe(0);
  });

  it("sums materials and people", () => {
    const period = makePeriod("2026-05-01", "2026-05-02", [makeStockItem(100)], [makePerson(200)]);
    expect(periodTotal(period)).toBe(600);
  });
});

describe("B6 cost split", () => {
  it("only-people period", () => {
    const period = makePeriod("2026-05-01", "2026-05-01", [], [makePerson(100)]);
    expect(periodPeopleCost(period)).toBe(100);
    expect(periodMaterialsCost(period)).toBe(0);
  });

  it("only-materials period", () => {
    const period = makePeriod("2026-05-01", "2026-05-01", [makeStockItem(50)], []);
    expect(periodPeopleCost(period)).toBe(0);
    expect(periodMaterialsCost(period)).toBe(50);
  });

  it("mixed period sums equal periodTotal", () => {
    const period = makePeriod("2026-05-01", "2026-05-02", [makeStockItem(100)], [makePerson(200)]);
    expect(periodPeopleCost(period) + periodMaterialsCost(period)).toBe(periodTotal(period));
  });

  it("projectCostSummary totals equal sum of periods", () => {
    const p1 = makePeriod("2026-05-01", "2026-05-01", [makeStockItem(50)], [makePerson(100)]);
    const p2 = makePeriod("2026-05-02", "2026-05-02", [], [makePerson(200)]);
    const summary = projectCostSummary([p1, p2]);
    expect(summary.total).toBe(periodTotal(p1) + periodTotal(p2));
    expect(summary.people).toBe(100 + 200);
    expect(summary.materials).toBe(50);
  });
});
