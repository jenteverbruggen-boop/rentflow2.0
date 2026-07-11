import { describe, it, expect } from "vitest";
import { computeSharingMap } from "@/lib/bundle-sharing";

describe("computeSharingMap", () => {
  it("returns empty map for no components", () => {
    expect(computeSharingMap([])).toEqual(new Map());
  });

  it("no-share: each child belongs to exactly one set", () => {
    const map = computeSharingMap([
      { parentId: 1, parentName: "Set A", childId: 10 },
      { parentId: 2, parentName: "Set B", childId: 20 },
    ]);
    expect(map.get(10)).toEqual([{ id: 1, name: "Set A" }]);
    expect(map.get(20)).toEqual([{ id: 2, name: "Set B" }]);
  });

  it("2-set share: one child in two sets", () => {
    const map = computeSharingMap([
      { parentId: 1, parentName: "Set A", childId: 10 },
      { parentId: 2, parentName: "Set B", childId: 10 },
    ]);
    expect(map.get(10)).toEqual([
      { id: 1, name: "Set A" },
      { id: 2, name: "Set B" },
    ]);
  });

  it("3-set share: one child in three sets", () => {
    const map = computeSharingMap([
      { parentId: 1, parentName: "Set A", childId: 10 },
      { parentId: 2, parentName: "Set B", childId: 10 },
      { parentId: 3, parentName: "Set C", childId: 10 },
    ]);
    expect(map.get(10)).toHaveLength(3);
    expect(map.get(10)!.map((s) => s.name)).toEqual(["Set A", "Set B", "Set C"]);
  });
});
