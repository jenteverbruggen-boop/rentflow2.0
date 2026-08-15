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
