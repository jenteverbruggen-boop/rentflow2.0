import { describe, it, expect } from "vitest";
import { periodRangeSchema, periodOverlapsProject } from "./period-validation";

describe("periodRangeSchema (H4.3)", () => {
  it("accepts a valid range", () => {
    const result = periodRangeSchema.safeParse({
      name: "Test",
      startDate: "2026-06-05T08:00:00.000Z",
      endDate: "2026-06-05T17:00:00.000Z",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an inverted range", () => {
    const result = periodRangeSchema.safeParse({
      name: "Test",
      startDate: "2026-06-05T17:00:00.000Z",
      endDate: "2026-06-05T08:00:00.000Z",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a zero-duration range (endDate === startDate) — tightened from the client's previous >=", () => {
    const result = periodRangeSchema.safeParse({
      name: "Test",
      startDate: "2026-06-05T08:00:00.000Z",
      endDate: "2026-06-05T08:00:00.000Z",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unparseable date", () => {
    const result = periodRangeSchema.safeParse({
      name: "Test",
      startDate: "not-a-date",
      endDate: "2026-06-05T17:00:00.000Z",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing name", () => {
    const result = periodRangeSchema.safeParse({
      name: "",
      startDate: "2026-06-05T08:00:00.000Z",
      endDate: "2026-06-05T17:00:00.000Z",
    });
    expect(result.success).toBe(false);
  });
});

describe("periodOverlapsProject (H4.3)", () => {
  const project = {
    startDate: new Date("2026-06-01T00:00:00Z"),
    endDate: new Date("2026-06-10T00:00:00Z"),
  };

  it("a period inside the project range overlaps", () => {
    expect(
      periodOverlapsProject(
        {
          startDate: new Date("2026-06-05T08:00:00Z"),
          endDate: new Date("2026-06-05T17:00:00Z"),
        },
        project,
      ),
    ).toBe(true);
  });

  it("a period on the project's last calendar day overlaps (advisory, not blocking)", () => {
    expect(
      periodOverlapsProject(
        {
          startDate: new Date("2026-06-10T08:00:00Z"),
          endDate: new Date("2026-06-10T17:00:00Z"),
        },
        project,
      ),
    ).toBe(true);
  });

  it("a period entirely after the project range does not overlap", () => {
    expect(
      periodOverlapsProject(
        {
          startDate: new Date("2026-07-01T08:00:00Z"),
          endDate: new Date("2026-07-01T17:00:00Z"),
        },
        project,
      ),
    ).toBe(false);
  });

  it("a period entirely before the project range does not overlap", () => {
    expect(
      periodOverlapsProject(
        {
          startDate: new Date("2026-05-01T08:00:00Z"),
          endDate: new Date("2026-05-01T17:00:00Z"),
        },
        project,
      ),
    ).toBe(false);
  });
});

describe("periodOverlapsProject — timezone/DST edge cases (review fix)", () => {
  // project.startDate/endDate are stored as bare UTC-midnight calendar
  // dates (project-form.tsx's date-only input); a period's own dates
  // carry real Brussels wall-clock instants (H1). Before this fix,
  // comparing them as raw instants was wrong near midnight.
  const project = {
    startDate: new Date("2026-06-01T00:00:00Z"),
    endDate: new Date("2026-06-10T00:00:00Z"),
  };

  it("a period starting 00:30 Brussels time (summer, CEST) on the project's own start date overlaps", () => {
    // 00:30 CEST on 2026-06-01 is 2026-05-31T22:30:00Z — earlier than the
    // project's own UTC-midnight start instant. Without widening the
    // project's start to its own Brussels start-of-day, this would have
    // been wrongly flagged as not overlapping at all.
    const period = {
      startDate: new Date("2026-05-31T22:30:00Z"),
      endDate: new Date("2026-06-01T02:00:00Z"),
    };
    expect(periodOverlapsProject(period, project)).toBe(true);
  });

  it("a period ending 23:30 Brussels time (summer, CEST) on the project's own end date overlaps", () => {
    // 23:30 CEST on 2026-06-10 is 2026-06-10T21:30:00Z — before the
    // project's own bare UTC-midnight endDate, so this specific case
    // already worked pre-fix; kept as a same-day sanity check alongside
    // the true edge case below.
    const period = {
      startDate: new Date("2026-06-10T18:00:00Z"),
      endDate: new Date("2026-06-10T21:30:00Z"),
    };
    expect(periodOverlapsProject(period, project)).toBe(true);
  });

  it("a period starting 00:30 Brussels time (winter, CET) on the project's own start date overlaps", () => {
    const winterProject = {
      startDate: new Date("2026-01-05T00:00:00Z"),
      endDate: new Date("2026-01-10T00:00:00Z"),
    };
    // 00:30 CET on 2026-01-05 is 2026-01-04T23:30:00Z.
    const period = {
      startDate: new Date("2026-01-04T23:30:00Z"),
      endDate: new Date("2026-01-05T02:00:00Z"),
    };
    expect(periodOverlapsProject(period, winterProject)).toBe(true);
  });

  it("the same early-morning shape correctly does NOT overlap when the period is genuinely a day earlier", () => {
    // 00:30 CEST on 2026-05-31 (a real day before the project starts) is
    // 2026-05-30T22:30:00Z — must still be excluded; the widening must
    // not swallow a period that's actually outside the range.
    const period = {
      startDate: new Date("2026-05-30T22:30:00Z"),
      endDate: new Date("2026-05-31T02:00:00Z"),
    };
    expect(periodOverlapsProject(period, project)).toBe(false);
  });

  it("straddles the spring-forward DST transition (project spans across it)", () => {
    const dstProject = {
      startDate: new Date("2026-03-28T00:00:00Z"),
      endDate: new Date("2026-03-30T00:00:00Z"),
    };
    // 00:30 Brussels time on the 30th is CEST (+2) → 2026-03-29T22:30:00Z,
    // still before the project's own bare UTC-midnight endDate but must
    // be treated as within the widened Brussels day.
    const period = {
      startDate: new Date("2026-03-29T22:30:00Z"),
      endDate: new Date("2026-03-30T05:00:00Z"),
    };
    expect(periodOverlapsProject(period, dstProject)).toBe(true);
  });

  it("straddles the autumn fall-back DST transition (project spans across it)", () => {
    const dstProject = {
      startDate: new Date("2026-10-24T00:00:00Z"),
      endDate: new Date("2026-10-26T00:00:00Z"),
    };
    // 00:30 Brussels time on the 26th is CET (+1) → 2026-10-25T23:30:00Z,
    // after the project's own bare UTC-midnight endDate but still within
    // the widened Brussels calendar day for the 26th... actually this
    // project ends on the 26th, so 00:30 on the 26th itself is inside
    // the range by construction; assert it's not incorrectly excluded.
    const period = {
      startDate: new Date("2026-10-25T23:30:00Z"),
      endDate: new Date("2026-10-26T05:00:00Z"),
    };
    expect(periodOverlapsProject(period, dstProject)).toBe(true);
  });
});
