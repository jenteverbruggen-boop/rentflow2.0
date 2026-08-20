import { describe, it, expect } from "vitest";
import { brusselsWallClockToUtc, brusselsStartOfDay, brusselsEndOfDay } from "./brussels-time";

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

describe("brusselsStartOfDay / brusselsEndOfDay (period-range timezone fix)", () => {
  it("start of day is 22:00 UTC the previous day in summer (CEST, UTC+2)", () => {
    const date = new Date("2026-06-05T00:00:00Z");
    expect(brusselsStartOfDay(date).toISOString()).toBe("2026-06-04T22:00:00.000Z");
  });

  it("start of day is 23:00 UTC the previous day in winter (CET, UTC+1)", () => {
    const date = new Date("2026-01-05T00:00:00Z");
    expect(brusselsStartOfDay(date).toISOString()).toBe("2026-01-04T23:00:00.000Z");
  });

  it("end of day (exclusive upper bound) is the start of the next Brussels day, summer", () => {
    const date = new Date("2026-06-05T00:00:00Z");
    expect(brusselsEndOfDay(date).toISOString()).toBe("2026-06-05T22:00:00.000Z");
  });

  it("end of day (exclusive upper bound) is the start of the next Brussels day, winter", () => {
    const date = new Date("2026-01-05T00:00:00Z");
    expect(brusselsEndOfDay(date).toISOString()).toBe("2026-01-05T23:00:00.000Z");
  });

  it("straddles the spring-forward DST transition (2026-03-29) correctly", () => {
    // The night of 28→29 March 2026 is still CET (+1); 29→30 is CEST (+2).
    const beforeDst = new Date("2026-03-28T00:00:00Z");
    const onDst = new Date("2026-03-29T00:00:00Z");
    expect(brusselsStartOfDay(beforeDst).toISOString()).toBe("2026-03-27T23:00:00.000Z");
    expect(brusselsStartOfDay(onDst).toISOString()).toBe("2026-03-28T23:00:00.000Z");
    // End-of-day for the 29th lands after the clocks have sprung forward.
    expect(brusselsEndOfDay(onDst).toISOString()).toBe("2026-03-29T22:00:00.000Z");
  });

  it("straddles the autumn fall-back DST transition (2026-10-25) correctly", () => {
    const beforeDst = new Date("2026-10-24T00:00:00Z");
    const onDst = new Date("2026-10-25T00:00:00Z");
    expect(brusselsStartOfDay(beforeDst).toISOString()).toBe("2026-10-23T22:00:00.000Z");
    expect(brusselsStartOfDay(onDst).toISOString()).toBe("2026-10-24T22:00:00.000Z");
    // End-of-day for the 25th lands after the clocks have fallen back.
    expect(brusselsEndOfDay(onDst).toISOString()).toBe("2026-10-25T23:00:00.000Z");
  });
});
