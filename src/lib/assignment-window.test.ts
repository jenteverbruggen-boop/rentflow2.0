import { describe, it, expect } from "vitest";
import {
  effectiveWindow,
  effectiveWindows,
  overlapsWindow,
  validateAssignmentWindow,
} from "./assignment-window";

const period = {
  startDate: new Date("2026-06-01T00:00:00Z"),
  endDate: new Date("2026-06-05T00:00:00Z"),
};

describe("effectiveWindow (H1)", () => {
  it("falls back to the period's window when startAt/endAt are null — the regression case", () => {
    const result = effectiveWindow({ startAt: null, endAt: null, period });
    expect(result).toEqual({ from: period.startDate, to: period.endDate });
  });

  it("uses the assignment's own window when set, narrower than the period", () => {
    const startAt = new Date("2026-06-01T18:00:00Z");
    const endAt = new Date("2026-06-01T23:00:00Z");
    const result = effectiveWindow({ startAt, endAt, period });
    expect(result).toEqual({ from: startAt, to: endAt });
  });
});

describe("validateAssignmentWindow (H1.3)", () => {
  it("accepts a window fully inside the period with endAt after startAt", () => {
    const result = validateAssignmentWindow(
      { startAt: new Date("2026-06-01T18:00:00Z"), endAt: new Date("2026-06-01T23:00:00Z") },
      period,
    );
    expect(result).toBeNull();
  });

  it("rejects endAt equal to startAt", () => {
    const t = new Date("2026-06-01T18:00:00Z");
    const result = validateAssignmentWindow({ startAt: t, endAt: t }, period);
    expect(result).toEqual(expect.any(String));
  });

  it("rejects endAt before startAt", () => {
    const result = validateAssignmentWindow(
      { startAt: new Date("2026-06-01T18:00:00Z"), endAt: new Date("2026-06-01T10:00:00Z") },
      period,
    );
    expect(result).toEqual(expect.any(String));
  });

  it("rejects a window starting before the period", () => {
    const result = validateAssignmentWindow(
      { startAt: new Date("2026-05-31T18:00:00Z"), endAt: new Date("2026-06-01T10:00:00Z") },
      period,
    );
    expect(result).toEqual(expect.any(String));
  });

  it("rejects a window ending after the period", () => {
    const result = validateAssignmentWindow(
      { startAt: new Date("2026-06-04T18:00:00Z"), endAt: new Date("2026-06-06T10:00:00Z") },
      period,
    );
    expect(result).toEqual(expect.any(String));
  });

  it("accepts a window that exactly touches both period boundaries", () => {
    const result = validateAssignmentWindow(
      { startAt: period.startDate, endAt: period.endDate },
      period,
    );
    expect(result).toBeNull();
  });
});

describe("effectiveWindows / overlapsWindow with day rows (H6)", () => {
  const days = [
    { startAt: new Date("2026-06-01T08:00:00Z"), endAt: new Date("2026-06-01T17:00:00Z") },
    { startAt: new Date("2026-06-04T08:00:00Z"), endAt: new Date("2026-06-04T17:00:00Z") },
  ];

  it("returns one window per selected day, earliest first", () => {
    const result = effectiveWindows({ startAt: null, endAt: null, period, days: [days[1], days[0]] });
    expect(result).toEqual([
      { from: days[0].startAt, to: days[0].endAt },
      { from: days[1].startAt, to: days[1].endAt },
    ]);
  });

  it("day rows win over the period fallback", () => {
    const result = effectiveWindows({ startAt: null, endAt: null, period, days: [days[0]] });
    expect(result).toEqual([{ from: days[0].startAt, to: days[0].endAt }]);
  });

  it("the envelope spans first start to last end, so single-window consumers still work", () => {
    const result = effectiveWindow({ startAt: null, endAt: null, period, days });
    expect(result).toEqual({ from: days[0].startAt, to: days[1].endAt });
  });

  it("a gap day between two selected days is free — the point of H6", () => {
    const assignment = { startAt: null, endAt: null, period, days };
    const gapDay = { from: new Date("2026-06-02T00:00:00Z"), to: new Date("2026-06-03T00:00:00Z") };
    expect(overlapsWindow(assignment, gapDay)).toBeNull();
  });

  it("a selected day does conflict", () => {
    const assignment = { startAt: null, endAt: null, period, days };
    const worked = { from: new Date("2026-06-04T09:00:00Z"), to: new Date("2026-06-04T10:00:00Z") };
    expect(overlapsWindow(assignment, worked)).toEqual({ from: days[1].startAt, to: days[1].endAt });
  });

  it("with no day rows, the whole period conflicts — unchanged pre-H6 behaviour", () => {
    const assignment = { startAt: null, endAt: null, period };
    const gapDay = { from: new Date("2026-06-02T00:00:00Z"), to: new Date("2026-06-03T00:00:00Z") };
    expect(overlapsWindow(assignment, gapDay)).toEqual({ from: period.startDate, to: period.endDate });
  });
});
