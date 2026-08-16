import { describe, it, expect } from "vitest";
import { monthKey, monthsInRange, monthWeights } from "@/lib/stats-months";

describe("monthsInRange (K1.1)", () => {
  it("a single-month range returns exactly that month", () => {
    expect(monthsInRange(new Date("2026-06-01"), new Date("2026-06-30"))).toEqual(["2026-06"]);
  });

  it("a range spanning several months returns every touched month", () => {
    expect(monthsInRange(new Date("2026-05-15"), new Date("2026-07-02"))).toEqual([
      "2026-05", "2026-06", "2026-07",
    ]);
  });
});

describe("monthWeights (K1.1's decided pro-rata rule)", () => {
  it("a period entirely inside one month gets weight 1 for that month", () => {
    const weights = monthWeights(new Date("2026-06-01"), new Date("2026-06-05"));
    expect(weights.size).toBe(1);
    expect(weights.get("2026-06")).toBe(1);
  });

  it("2026-05-28 → 2026-06-03 (the brief's own example) splits pro-rata by calendar days", () => {
    // May 28,29,30,31 = 4 days; June 1,2,3 = 3 days; 7 days total.
    const weights = monthWeights(new Date("2026-05-28"), new Date("2026-06-03"));
    expect(weights.get("2026-05")).toBeCloseTo(4 / 7, 10);
    expect(weights.get("2026-06")).toBeCloseTo(3 / 7, 10);
    expect(weights.get("2026-05")! + weights.get("2026-06")!).toBeCloseTo(1, 10);
  });

  it("monthKey formats with a zero-padded month", () => {
    expect(monthKey(new Date(2026, 0, 15))).toBe("2026-01");
  });
});
