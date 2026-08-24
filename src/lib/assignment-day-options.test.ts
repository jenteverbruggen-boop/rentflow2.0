import { describe, it, expect } from "vitest";
import { format } from "date-fns";
import {
  buildDayOptions,
  dayOptionToWindow,
  defaultDayTimes,
  selectedWindows,
} from "./assignment-day-options";

/**
 * These helpers deliberately work in the *local* timezone (the picker's
 * `type="time"` inputs are local wall-clock), so the assertions compare
 * against locally formatted values rather than hard-coded UTC strings —
 * otherwise the suite would pass only in the timezone it was written in.
 */
const local = (iso: string) => format(new Date(iso), "HH:mm");

describe("defaultDayTimes (H6)", () => {
  it("uses the period's own start and end time of day", () => {
    const start = new Date("2026-08-31T06:00:00Z");
    const end = new Date("2026-09-04T15:00:00Z");
    expect(defaultDayTimes(start, end)).toEqual({
      from: local("2026-08-31T06:00:00Z"),
      to: local("2026-09-04T15:00:00Z"),
    });
  });

  it("falls back to 23:59 when the period's end time is not after its start time", () => {
    const start = new Date("2026-08-23T22:00:00Z");
    const end = new Date("2026-08-25T21:59:00Z");
    expect(defaultDayTimes(start, end).to).toBe("23:59");
  });
});

describe("buildDayOptions (H6)", () => {
  const period = { startDate: "2026-06-01T08:00:00Z", endDate: "2026-06-03T17:00:00Z" };

  it("returns one row per calendar day of the period, none selected by default", () => {
    const options = buildDayOptions(period, undefined);
    expect(options).toHaveLength(3);
    expect(options.every((o) => !o.selected)).toBe(true);
  });

  it("pre-selects the days the assignment already has, with their saved hours", () => {
    const saved = [
      {
        id: 1,
        periodPersonId: 9,
        startAt: "2026-06-02T09:30:00Z",
        endAt: "2026-06-02T12:00:00Z",
      },
    ];
    const options = buildDayOptions(period, saved);
    const selected = options.filter((o) => o.selected);
    expect(selected).toHaveLength(1);
    expect(selected[0].from).toBe(local("2026-06-02T09:30:00Z"));
    expect(selected[0].to).toBe(local("2026-06-02T12:00:00Z"));
  });

  it("keys rows by the local calendar day, so a saved day never lands on the wrong row", () => {
    const options = buildDayOptions(period, undefined);
    expect(options.map((o) => o.key)).toEqual([
      format(new Date("2026-06-01T08:00:00Z"), "yyyy-MM-dd"),
      format(new Date("2026-06-02T08:00:00Z"), "yyyy-MM-dd"),
      format(new Date("2026-06-03T08:00:00Z"), "yyyy-MM-dd"),
    ]);
  });
});

describe("dayOptionToWindow (H6)", () => {
  const option = { key: "2026-06-02", label: "", selected: true, from: "08:00", to: "17:00" };

  it("round-trips a normal day into a same-day instant pair", () => {
    const window = dayOptionToWindow(option);
    expect(new Date(window.startAt)).toEqual(new Date("2026-06-02T08:00"));
    expect(new Date(window.endAt)).toEqual(new Date("2026-06-02T17:00"));
  });

  it("treats a `to` that is not after `from` as a night shift ending the next morning", () => {
    const window = dayOptionToWindow({ ...option, from: "22:00", to: "06:00" });
    expect(new Date(window.endAt)).toEqual(new Date("2026-06-03T06:00"));
    expect(new Date(window.endAt) > new Date(window.startAt)).toBe(true);
  });
});

describe("selectedWindows (H6)", () => {
  it("sends only the ticked days", () => {
    const options = [
      { key: "2026-06-01", label: "", selected: true, from: "08:00", to: "17:00" },
      { key: "2026-06-02", label: "", selected: false, from: "08:00", to: "17:00" },
      { key: "2026-06-03", label: "", selected: true, from: "08:00", to: "12:00" },
    ];
    expect(selectedWindows(options)).toHaveLength(2);
  });

  it("is empty when nothing is ticked — the payload that clears back to the whole period", () => {
    expect(selectedWindows([])).toEqual([]);
  });
});
