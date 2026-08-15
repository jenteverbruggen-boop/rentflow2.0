import { describe, it, expect } from "vitest";
import { brusselsWallClockToUtc } from "./brussels-time";

describe("brusselsWallClockToUtc (H4.2)", () => {
  it("converts 08:00/17:00 correctly in summer (CEST, UTC+2)", () => {
    const date = new Date("2026-06-05T00:00:00Z");
    expect(brusselsWallClockToUtc(date, 8, 0).toISOString()).toBe(
      "2026-06-05T06:00:00.000Z",
    );
    expect(brusselsWallClockToUtc(date, 17, 0).toISOString()).toBe(
      "2026-06-05T15:00:00.000Z",
    );
  });

  it("converts 08:00/17:00 correctly in winter (CET, UTC+1)", () => {
    const date = new Date("2026-01-05T00:00:00Z");
    expect(brusselsWallClockToUtc(date, 8, 0).toISOString()).toBe(
      "2026-01-05T07:00:00.000Z",
    );
    expect(brusselsWallClockToUtc(date, 17, 0).toISOString()).toBe(
      "2026-01-05T16:00:00.000Z",
    );
  });

  it("handles the DST transition dates themselves", () => {
    // 2026: CEST starts last Sunday of March (29th), ends last Sunday of
    // October (25th) — one day before/after should straddle the offset.
    const beforeDst = new Date("2026-03-28T00:00:00Z");
    const afterDst = new Date("2026-03-30T00:00:00Z");
    expect(brusselsWallClockToUtc(beforeDst, 8, 0).toISOString()).toBe(
      "2026-03-28T07:00:00.000Z",
    );
    expect(brusselsWallClockToUtc(afterDst, 8, 0).toISOString()).toBe(
      "2026-03-30T06:00:00.000Z",
    );
  });
});
