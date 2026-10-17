import { describe, it, expect } from "vitest";
import { aggregateBookedByMonth } from "@/lib/stats-booked";
import type { Period, PeriodPerson } from "@/types";

function makePerson(snapshot: number): PeriodPerson {
  return {
    id: 1, periodId: 1, personId: 1, functionId: null,
    startAt: null, endAt: null, overlapAck: false, billingUnit: "dag",
    rateSnapshot: null, dayPriceSnapshot: snapshot, discountPct: null, discountAmount: null,
    travelCosts: [],
    person: { id: 1, name: "Test", email: null, phone: null, address: null, postalCode: null, city: null, country: null, dayPrice: snapshot },
  };
}

function makePeriod(start: string, end: string, people: PeriodPerson[] = []): Period {
  return { id: 1, projectId: 1, name: "Test", startDate: start, endDate: end, updatedAt: start, materials: [], people, bundleBookings: [] };
}

describe("aggregateBookedByMonth (K1.1)", () => {
  it("a period entirely inside one month attributes its full cost to that month", () => {
    const period = makePeriod("2026-06-01", "2026-06-02", [makePerson(100)]);
    const byMonth = aggregateBookedByMonth([period]);
    expect(byMonth.get("2026-06")?.bookedPeople.agreed).toBe(200); // 2 days x 100
    expect(byMonth.size).toBe(1);
  });

  it("a period spanning a month boundary splits pro-rata by calendar days (the brief's own example)", () => {
    // May 28-31 (4 days) + Jun 1-3 (3 days) = 7 days total, 100/day = 700.
    const period = makePeriod("2026-05-28", "2026-06-03", [makePerson(100)]);
    const byMonth = aggregateBookedByMonth([period]);
    expect(byMonth.get("2026-05")?.bookedPeople.agreed).toBeCloseTo(400, 5);
    expect(byMonth.get("2026-06")?.bookedPeople.agreed).toBeCloseTo(300, 5);
  });

  it("multiple periods in the same month accumulate", () => {
    const a = makePeriod("2026-06-01", "2026-06-01", [makePerson(100)]);
    const b = makePeriod("2026-06-10", "2026-06-10", [makePerson(50)]);
    const byMonth = aggregateBookedByMonth([a, b]);
    expect(byMonth.get("2026-06")?.bookedPeople.agreed).toBe(150);
    expect(byMonth.get("2026-06")?.booked.agreed).toBe(150);
  });
});

describe("aggregateBookedByMonth buckets (D1)", () => {
  it("splits agreed from still-to-confirm by project status, and the buckets sum to the total", () => {
    const agreed = { ...makePeriod("2026-06-01", "2026-06-01", [makePerson(100)]), bucket: "afgesproken" as const };
    const pending = { ...makePeriod("2026-06-02", "2026-06-02", [makePerson(40)]), bucket: "teBevestigen" as const };
    const june = aggregateBookedByMonth([agreed, pending]).get("2026-06")!;
    expect(june.booked).toEqual({ agreed: 100, pending: 40 });
    expect(june.bookedPeople).toEqual({ agreed: 100, pending: 40 });
    expect(june.bookedMaterials).toEqual({ agreed: 0, pending: 0 });
  });
});
