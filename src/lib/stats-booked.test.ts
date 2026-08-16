import { describe, it, expect } from "vitest";
import { aggregateBookedByMonth } from "@/lib/stats-booked";
import type { Period, PeriodPerson } from "@/types";

function makePerson(snapshot: number): PeriodPerson {
  return {
    id: 1, periodId: 1, personId: 1, functionId: null, role: null,
    startAt: null, endAt: null, overlapAck: false, billingUnit: "dag",
    rateSnapshot: null, dayPriceSnapshot: snapshot, discountPct: null, discountAmount: null,
    travelCosts: [],
    person: { id: 1, name: "Test", role: null, email: null, phone: null, address: null, postalCode: null, city: null, country: null, dayPrice: snapshot },
  };
}

function makePeriod(start: string, end: string, people: PeriodPerson[] = []): Period {
  return { id: 1, projectId: 1, name: "Test", startDate: start, endDate: end, materials: [], people, bundleBookings: [] };
}

describe("aggregateBookedByMonth (K1.1)", () => {
  it("a period entirely inside one month attributes its full cost to that month", () => {
    const period = makePeriod("2026-06-01", "2026-06-02", [makePerson(100)]);
    const byMonth = aggregateBookedByMonth([period]);
    expect(byMonth.get("2026-06")?.bookedPeople).toBe(200); // 2 days x 100
    expect(byMonth.size).toBe(1);
  });

  it("a period spanning a month boundary splits pro-rata by calendar days (the brief's own example)", () => {
    // May 28-31 (4 days) + Jun 1-3 (3 days) = 7 days total, 100/day = 700.
    const period = makePeriod("2026-05-28", "2026-06-03", [makePerson(100)]);
    const byMonth = aggregateBookedByMonth([period]);
    expect(byMonth.get("2026-05")?.bookedPeople).toBeCloseTo(400, 5);
    expect(byMonth.get("2026-06")?.bookedPeople).toBeCloseTo(300, 5);
  });

  it("multiple periods in the same month accumulate", () => {
    const a = makePeriod("2026-06-01", "2026-06-01", [makePerson(100)]);
    const b = makePeriod("2026-06-10", "2026-06-10", [makePerson(50)]);
    const byMonth = aggregateBookedByMonth([a, b]);
    expect(byMonth.get("2026-06")?.bookedPeople).toBe(150);
    expect(byMonth.get("2026-06")?.booked).toBe(150);
  });
});
