import { describe, it, expect } from "vitest";
import { aggregatePersonUtilisation } from "@/lib/stats-utilisation";
import type { Period, PeriodPerson } from "@/types";

function makePerson(
  personId: number, name: string,
  opts?: { billingUnit?: "dag" | "uur"; startAt?: string | null; endAt?: string | null },
): PeriodPerson {
  return {
    id: personId, periodId: 1, personId, functionId: null, role: null,
    startAt: opts?.startAt ?? null, endAt: opts?.endAt ?? null, overlapAck: false,
    billingUnit: opts?.billingUnit ?? "dag", rateSnapshot: null, dayPriceSnapshot: 100,
    discountPct: null, discountAmount: null, travelCosts: [],
    person: { id: personId, name, role: null, email: null, phone: null, address: null, postalCode: null, city: null, country: null, dayPrice: 100 },
  };
}

function makePeriod(start: string, end: string, people: PeriodPerson[]): Period {
  return { id: 1, projectId: 1, name: "Test", startDate: start, endDate: end, materials: [], people, bundleBookings: [] };
}

describe("aggregatePersonUtilisation (K1.1)", () => {
  it("a day-billed assignment counts the period's days toward bookedDays", () => {
    const period = makePeriod("2026-06-01", "2026-06-03", [makePerson(1, "Jan")]);
    const [entry] = aggregatePersonUtilisation([period]);
    expect(entry.bookedDays).toBe(3);
    expect(entry.bookedHours).toBe(0);
  });

  it("an hourly assignment with a real window counts hours, not days", () => {
    const period = makePeriod("2026-06-01", "2026-06-01", [
      makePerson(1, "Jan", { billingUnit: "uur", startAt: "2026-06-01T18:00:00Z", endAt: "2026-06-01T23:00:00Z" }),
    ]);
    const [entry] = aggregatePersonUtilisation([period]);
    expect(entry.bookedHours).toBe(5);
    expect(entry.bookedDays).toBe(0);
  });

  it("an hourly booking with no window falls back to a full day (Q19)", () => {
    const period = makePeriod("2026-06-01", "2026-06-01", [makePerson(1, "Jan", { billingUnit: "uur" })]);
    const [entry] = aggregatePersonUtilisation([period]);
    expect(entry.bookedDays).toBe(1);
  });

  it("accumulates across periods and sorts by name", () => {
    const a = makePeriod("2026-06-01", "2026-06-01", [makePerson(2, "Zoe")]);
    const b = makePeriod("2026-06-05", "2026-06-05", [makePerson(1, "Alice")]);
    const c = makePeriod("2026-06-10", "2026-06-10", [makePerson(2, "Zoe")]);
    const entries = aggregatePersonUtilisation([a, b, c]);
    expect(entries.map((e) => e.name)).toEqual(["Alice", "Zoe"]);
    expect(entries.find((e) => e.name === "Zoe")?.bookedDays).toBe(2);
  });
});
