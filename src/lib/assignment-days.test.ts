import { describe, it, expect } from "vitest";
import {
  billedDays,
  billedHours,
  daysEnvelope,
  validateAssignmentDays,
} from "./assignment-days";

const period = {
  startDate: new Date("2026-06-01T00:00:00Z"),
  endDate: new Date("2026-06-05T23:59:00Z"),
};

/** Mon 1 Jun 08:00-17:00 and Wed 3 Jun 08:00-17:00 — two days out of five. */
const twoDays = [
  { startAt: "2026-06-01T08:00:00Z", endAt: "2026-06-01T17:00:00Z" },
  { startAt: "2026-06-03T08:00:00Z", endAt: "2026-06-03T17:00:00Z" },
];

describe("billedDays (H6)", () => {
  it("no day rows bills the whole period — every pre-H6 booking is unchanged", () => {
    expect(billedDays({ startAt: null, endAt: null, period }, 5)).toBe(5);
  });

  it("a single-window assignment still bills the whole period (H1.3 was never a discount)", () => {
    const assignment = {
      startAt: "2026-06-01T18:00:00Z",
      endAt: "2026-06-01T23:00:00Z",
      period,
    };
    expect(billedDays(assignment, 5)).toBe(5);
  });

  it("two selected days out of five bill two days", () => {
    expect(billedDays({ startAt: null, endAt: null, period, days: twoDays }, 5)).toBe(2);
  });

  it("a night shift crossing midnight is one day, in any timezone", () => {
    const overnight = [{ startAt: "2026-06-01T22:00:00Z", endAt: "2026-06-02T06:00:00Z" }];
    expect(billedDays({ startAt: null, endAt: null, period, days: overnight }, 5)).toBe(1);
  });

  it("a row longer than a day rounds up rather than counting as one", () => {
    const long = [{ startAt: "2026-06-01T08:00:00Z", endAt: "2026-06-03T17:00:00Z" }];
    expect(billedDays({ startAt: null, endAt: null, period, days: long }, 5)).toBe(3);
  });

  it("ignores half-written rows (a null side) rather than counting them", () => {
    const partial = [{ startAt: "2026-06-01T08:00:00Z", endAt: null }];
    expect(billedDays({ startAt: null, endAt: null, period, days: partial }, 5)).toBe(5);
  });
});

describe("billedHours (H6)", () => {
  it("sums the hours of every selected day", () => {
    expect(billedHours({ startAt: null, endAt: null, period, days: twoDays })).toBe(18);
  });

  it("returns null for a whole-period booking — there is no hour count to bill", () => {
    expect(billedHours({ startAt: null, endAt: null, period })).toBeNull();
  });

  it("falls back to the single window when there are no day rows", () => {
    const assignment = {
      startAt: "2026-06-01T18:00:00Z",
      endAt: "2026-06-01T22:30:00Z",
      period,
    };
    expect(billedHours(assignment)).toBe(4.5);
  });
});

describe("validateAssignmentDays (H6)", () => {
  const asDates = (rows: { startAt: string; endAt: string }[]) =>
    rows.map((r) => ({ startAt: new Date(r.startAt), endAt: new Date(r.endAt) }));

  it("accepts an empty set — that is how the picker clears back to the whole period", () => {
    expect(validateAssignmentDays([], period)).toBeNull();
  });

  it("accepts two non-overlapping days inside the period", () => {
    expect(validateAssignmentDays(asDates(twoDays), period)).toBeNull();
  });

  it("rejects a day that starts before the period", () => {
    const rows = asDates([{ startAt: "2026-05-31T08:00:00Z", endAt: "2026-05-31T17:00:00Z" }]);
    expect(validateAssignmentDays(rows, period)).toEqual(expect.any(String));
  });

  it("rejects a day that ends after the period", () => {
    const rows = asDates([{ startAt: "2026-06-05T08:00:00Z", endAt: "2026-06-06T02:00:00Z" }]);
    expect(validateAssignmentDays(rows, period)).toEqual(expect.any(String));
  });

  it("rejects a zero-length day", () => {
    const t = "2026-06-02T08:00:00Z";
    expect(validateAssignmentDays(asDates([{ startAt: t, endAt: t }]), period)).toEqual(
      expect.any(String),
    );
  });

  it("rejects two days that overlap each other — they would double-bill the same hours", () => {
    const rows = asDates([
      { startAt: "2026-06-02T08:00:00Z", endAt: "2026-06-02T17:00:00Z" },
      { startAt: "2026-06-02T16:00:00Z", endAt: "2026-06-02T20:00:00Z" },
    ]);
    expect(validateAssignmentDays(rows, period)).toEqual(expect.any(String));
  });

  it("accepts two days that touch exactly at a boundary", () => {
    const rows = asDates([
      { startAt: "2026-06-02T08:00:00Z", endAt: "2026-06-02T12:00:00Z" },
      { startAt: "2026-06-02T12:00:00Z", endAt: "2026-06-02T17:00:00Z" },
    ]);
    expect(validateAssignmentDays(rows, period)).toBeNull();
  });

  it("rejects an unparseable date instead of writing an Invalid Date", () => {
    const rows = [{ startAt: new Date("nonsense"), endAt: new Date("2026-06-02T17:00:00Z") }];
    expect(validateAssignmentDays(rows, period)).toEqual(expect.any(String));
  });
});

describe("daysEnvelope (H6)", () => {
  it("spans the earliest start and the latest end, whatever the input order", () => {
    const rows = [
      { startAt: new Date("2026-06-03T08:00:00Z"), endAt: new Date("2026-06-03T17:00:00Z") },
      { startAt: new Date("2026-06-01T09:00:00Z"), endAt: new Date("2026-06-01T12:00:00Z") },
    ];
    expect(daysEnvelope(rows)).toEqual({
      startAt: new Date("2026-06-01T09:00:00Z"),
      endAt: new Date("2026-06-03T17:00:00Z"),
    });
  });

  it("is null for an empty set — meaning 'back to the whole period'", () => {
    expect(daysEnvelope([])).toBeNull();
  });
});
