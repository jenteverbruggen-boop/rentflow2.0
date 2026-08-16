import { describe, it, expect } from "vitest";
import { computeDayBlocks, type DayBlockPeriod } from "@/lib/planning-day-blocks";

function period(overrides: Partial<DayBlockPeriod> = {}): DayBlockPeriod {
  return {
    id: 1, projectId: 1, projectName: "Test", status: "actief",
    startDate: "2026-06-15T10:00:00", endDate: "2026-06-15T14:00:00",
    ...overrides,
  };
}

const DAY = new Date(2026, 5, 15);

describe("computeDayBlocks (I1.3)", () => {
  it("a period entirely inside 08:00-24:00 is positioned proportionally, never clamped", () => {
    // 10:00-14:00 of a 16h (08:00-24:00) axis: top = 2/16 = 12.5%, height = 4/16 = 25%.
    const [block] = computeDayBlocks(DAY, [period()]);
    expect(block.topPct).toBeCloseTo(12.5, 5);
    expect(block.heightPct).toBeCloseTo(25, 5);
    expect(block.clampedStart).toBe(false);
    expect(block.clampedEnd).toBe(false);
    expect(block.label).toBe("10:00–14:00");
  });

  it("a period starting before 08:00 clamps to the top, flagged, never hidden", () => {
    const [block] = computeDayBlocks(DAY, [period({ startDate: "2026-06-15T06:00:00", endDate: "2026-06-15T10:00:00" })]);
    expect(block.clampedStart).toBe(true);
    expect(block.topPct).toBe(0);
    expect(block.label).toBe("06:00–10:00"); // real time, not the clamped one
  });

  it("a period entirely before 08:00 still renders as a visible sliver, not silently hidden", () => {
    const [block] = computeDayBlocks(DAY, [period({ startDate: "2026-06-15T05:00:00", endDate: "2026-06-15T07:00:00" })]);
    expect(block).toBeDefined();
    expect(block.clampedStart).toBe(true);
    expect(block.heightPct).toBeGreaterThan(0);
  });

  it("a period running past midnight clamps to the bottom, flagged", () => {
    const [block] = computeDayBlocks(DAY, [period({ startDate: "2026-06-15T22:00:00", endDate: "2026-06-16T02:00:00" })]);
    expect(block.clampedEnd).toBe(true);
    expect(block.topPct + block.heightPct).toBeCloseTo(100, 5);
    expect(block.label).toBe("22:00–02:00");
  });

  it("excludes a period on a completely different day", () => {
    expect(computeDayBlocks(DAY, [period({ startDate: "2026-06-16T10:00:00", endDate: "2026-06-16T14:00:00" })])).toHaveLength(0);
  });

  it("multiple periods on the same day all render", () => {
    const blocks = computeDayBlocks(DAY, [
      period({ id: 1, startDate: "2026-06-15T08:00:00", endDate: "2026-06-15T10:00:00" }),
      period({ id: 2, startDate: "2026-06-15T18:00:00", endDate: "2026-06-15T23:00:00" }),
    ]);
    expect(blocks).toHaveLength(2);
  });
});
