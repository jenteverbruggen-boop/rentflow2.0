import { describe, it, expect } from "vitest";
import { stepDate, monthGridDays, parseViewParam, parseDateParam } from "@/lib/planning-dates";

describe("stepDate (I1.1)", () => {
  it("day view steps by one day", () => {
    expect(stepDate("day", new Date(2026, 5, 15), 1)).toEqual(new Date(2026, 5, 16));
    expect(stepDate("day", new Date(2026, 5, 15), -1)).toEqual(new Date(2026, 5, 14));
  });

  it("week view steps by seven days", () => {
    expect(stepDate("week", new Date(2026, 5, 15), 1)).toEqual(new Date(2026, 5, 22));
  });

  it("month view steps by one calendar month", () => {
    expect(stepDate("month", new Date(2026, 5, 15), 1)).toEqual(new Date(2026, 6, 15));
    expect(stepDate("month", new Date(2026, 0, 15), -1)).toEqual(new Date(2025, 11, 15));
  });
});

describe("monthGridDays (I1.2)", () => {
  it("includes leading/trailing padding so every week row is complete (weekStartsOn: 1)", () => {
    // June 2026: 1 June is a Monday, so no leading padding needed;
    // 30 June is a Tuesday, so trailing padding through Sunday 5 July.
    const days = monthGridDays(new Date(2026, 5, 15));
    expect(days[0]).toEqual(new Date(2026, 5, 1));
    expect(days[days.length - 1]).toEqual(new Date(2026, 6, 5));
    expect(days.length % 7).toBe(0);
  });

  it("pads a month that doesn't start on Monday", () => {
    // May 2026: 1 May is a Friday, so the grid must start on Monday 27 April.
    const days = monthGridDays(new Date(2026, 4, 15));
    expect(days[0]).toEqual(new Date(2026, 3, 27));
  });
});

describe("parseViewParam / parseDateParam (I1.1)", () => {
  it("defaults to week for anything unrecognised", () => {
    expect(parseViewParam(null)).toBe("week");
    expect(parseViewParam("bogus")).toBe("week");
    expect(parseViewParam("day")).toBe("day");
    expect(parseViewParam("month")).toBe("month");
  });

  it("defaults to today for a missing or unparseable date", () => {
    expect(parseDateParam(null).toDateString()).toBe(new Date().toDateString());
    expect(parseDateParam("not-a-date").toDateString()).toBe(new Date().toDateString());
  });

  it("parses a real date string", () => {
    expect(parseDateParam("2026-06-15").getUTCDate()).toBe(15);
  });
});
