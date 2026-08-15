import { describe, it, expect } from "vitest";
import { effectiveWindow, validateAssignmentWindow } from "./assignment-window";

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
