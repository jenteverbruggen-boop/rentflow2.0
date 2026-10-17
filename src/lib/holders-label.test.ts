import { describe, it, expect } from "vitest";
import { anonymousHolders, freeForLine } from "@/lib/holders-label";

describe("holders-label", () => {
  it("caps free units at the line quantity and ignores hired hints", () => {
    expect(freeForLine({ shortageId: 1, kind: "open", freeNow: 5, holders: [], more: 0 }, 2)).toBe(2);
    expect(freeForLine({ shortageId: 1, kind: "hired", ownFreeNow: 5 }, 2)).toBe(0);
    expect(freeForLine(undefined, 2)).toBe(0);
  });
  it("detects redacted holders", () => {
    expect(anonymousHolders([{ status: "concept", units: 1 }])).toBe(true);
    expect(anonymousHolders([{ name: "X", projectId: 1, status: "concept", units: 1 }])).toBe(false);
  });
});
