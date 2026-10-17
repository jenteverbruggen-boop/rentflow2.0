import { describe, it, expect } from "vitest";
import { statusBucket, addToSplit, emptySplit, roundSplit, splitTotal } from "@/lib/stats-status";

describe("stats-status (D1)", () => {
  it("buckets by project status; cancelled is left out", () => {
    expect(statusBucket("bevestigd")).toBe("afgesproken");
    expect(statusBucket("actief")).toBe("afgesproken");
    expect(statusBucket("afgerond")).toBe("afgesproken");
    expect(statusBucket("concept")).toBe("teBevestigen");
    expect(statusBucket("geannuleerd")).toBeNull();
  });
  it("accumulates into the right side of a split", () => {
    const s = emptySplit();
    addToSplit(s, "afgesproken", 10.004);
    addToSplit(s, "teBevestigen", 5);
    expect(roundSplit(s)).toEqual({ agreed: 10, pending: 5 });
    expect(splitTotal(s)).toBe(15);
  });
});
