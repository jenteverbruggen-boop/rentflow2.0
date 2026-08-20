import { describe, it, expect } from "vitest";
import { resolvePersonBasePrice } from "@/lib/person-base-price";
import type { PeriodPerson } from "@/types";

function makePersonBooking(overrides: Partial<PeriodPerson> = {}): PeriodPerson {
  return {
    id: 1,
    periodId: 1,
    personId: 1,
    functionId: null,
    startAt: null,
    endAt: null,
    overlapAck: false,
    billingUnit: "dag",
    rateSnapshot: null,
    dayPriceSnapshot: 100,
    discountPct: null,
    discountAmount: null,
    person: {
      id: 1,
      name: "Test Person",
      email: null,
      phone: null,
      address: null,
      postalCode: null,
      city: null,
      country: null,
      dayPrice: 450,
      functions: [],
    },
    function: null,
    ...overrides,
  };
}

describe("resolvePersonBasePrice (line-price-popover drift fix)", () => {
  it("falls back to the person's own dayPrice when no function is booked", () => {
    expect(resolvePersonBasePrice(makePersonBooking())).toBe(450);
  });

  it("uses the function's own default rate over the person's bare dayPrice", () => {
    const pp = makePersonBooking({
      functionId: 7,
      function: { id: 7, name: "Electrician", dayRate: 320, hourRate: 45 },
    });
    expect(resolvePersonBasePrice(pp)).toBe(320);
  });

  it("prefers the person's own per-function override rate over the function's default", () => {
    const pp = makePersonBooking({
      functionId: 7,
      function: { id: 7, name: "Electrician", dayRate: 320, hourRate: 45 },
      person: {
        id: 1,
        name: "Test Person",
        email: null,
        phone: null,
        address: null,
        postalCode: null,
        city: null,
        country: null,
        dayPrice: 450,
        functions: [{ personId: 1, functionId: 7, dayRate: 280, hourRate: 38 }],
      },
    });
    expect(resolvePersonBasePrice(pp)).toBe(280);
  });

  it("falls through to the function default when the person has an override for a DIFFERENT function", () => {
    const pp = makePersonBooking({
      functionId: 7,
      function: { id: 7, name: "Electrician", dayRate: 320, hourRate: 45 },
      person: {
        id: 1,
        name: "Test Person",
        email: null,
        phone: null,
        address: null,
        postalCode: null,
        city: null,
        country: null,
        dayPrice: 450,
        functions: [{ personId: 1, functionId: 99, dayRate: 999, hourRate: null }],
      },
    });
    expect(resolvePersonBasePrice(pp)).toBe(320);
  });

  it("falls through to the person's dayPrice when the booked function has no default rate set", () => {
    const pp = makePersonBooking({
      functionId: 7,
      function: { id: 7, name: "Generalist", dayRate: null, hourRate: null },
    });
    expect(resolvePersonBasePrice(pp)).toBe(450);
  });

  it("the exact regression shape: booking at a function rate different from the person's own dayPrice never drifts after this fix", () => {
    // Before this fix, basePrice was always pp.person.dayPrice (450),
    // so a booking correctly snapshotted at the function's rate (320)
    // would show |320 - 450| = 130 of "drift" forever, even though
    // nothing is actually stale.
    const pp = makePersonBooking({
      dayPriceSnapshot: 320,
      functionId: 7,
      function: { id: 7, name: "Electrician", dayRate: 320, hourRate: 45 },
    });
    const basePrice = resolvePersonBasePrice(pp);
    expect(Math.abs((pp.dayPriceSnapshot ?? 0) - basePrice)).toBeLessThan(0.005);
  });
});
