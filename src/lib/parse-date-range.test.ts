import { describe, it, expect } from "vitest";
import { parseDateRange } from "./parse-date-range";

describe("parseDateRange (H3.3 — inverted-range rejection)", () => {
  it("rejects a missing from or to", () => {
    expect(parseDateRange(null, "2026-06-01T17:00:00.000Z")).toBeNull();
    expect(parseDateRange("2026-06-01T08:00:00.000Z", null)).toBeNull();
  });

  it("rejects an unparseable date", () => {
    expect(parseDateRange("not-a-date", "2026-06-01T17:00:00.000Z")).toBeNull();
  });

  it("rejects an inverted range (to before from)", () => {
    expect(
      parseDateRange("2026-06-02T00:00:00.000Z", "2026-06-01T00:00:00.000Z"),
    ).toBeNull();
  });

  it("rejects a zero-width range (to === from)", () => {
    expect(
      parseDateRange("2026-06-01T08:00:00.000Z", "2026-06-01T08:00:00.000Z"),
    ).toBeNull();
  });

  it("accepts a valid range", () => {
    const result = parseDateRange(
      "2026-06-01T08:00:00.000Z",
      "2026-06-01T17:00:00.000Z",
    );
    expect(result).not.toBeNull();
    expect(result?.from.toISOString()).toBe("2026-06-01T08:00:00.000Z");
    expect(result?.to.toISOString()).toBe("2026-06-01T17:00:00.000Z");
  });
});
