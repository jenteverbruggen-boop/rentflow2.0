import { describe, it, expect } from "vitest";
import { aggregateBookedByClient } from "@/lib/stats-by-client";
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

function makePeriod(cost: number): Period {
  return { id: 1, projectId: 1, name: "Test", startDate: "2026-06-01", endDate: "2026-06-01", updatedAt: "2026-06-01", materials: [], people: [makePerson(cost)], bundleBookings: [] };
}

describe("aggregateBookedByClient (K1.1)", () => {
  it("sums booked revenue per client", () => {
    const byClient = aggregateBookedByClient([
      { period: makePeriod(100), clientId: 1, clientName: "Acme" },
      { period: makePeriod(50), clientId: 1, clientName: "Acme" },
      { period: makePeriod(200), clientId: 2, clientName: "Other" },
    ]);
    expect(byClient.get(1)).toEqual({ name: "Acme", booked: 150 });
    expect(byClient.get(2)).toEqual({ name: "Other", booked: 200 });
  });

  it("skips periods on a project with no client", () => {
    const byClient = aggregateBookedByClient([{ period: makePeriod(100), clientId: null, clientName: null }]);
    expect(byClient.size).toBe(0);
  });
});
