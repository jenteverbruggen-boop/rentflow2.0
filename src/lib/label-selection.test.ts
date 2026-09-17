import { describe, it, expect } from "vitest";
import { resolveLabelMaterials, toggleAllInSelection } from "@/lib/label-selection";

describe("toggleAllInSelection", () => {
  it("selects all visible ids when none of them are selected yet", () => {
    const result = toggleAllInSelection(new Set(), [1, 2, 3]);
    expect(result).toEqual(new Set([1, 2, 3]));
  });

  it("selects all visible ids when only some of them are selected", () => {
    const result = toggleAllInSelection(new Set([2]), [1, 2, 3]);
    expect(result).toEqual(new Set([1, 2, 3]));
  });

  it("deselects only the visible ids once all of them are selected", () => {
    const result = toggleAllInSelection(new Set([1, 2, 3]), [1, 2, 3]);
    expect(result).toEqual(new Set());
  });

  it("does not touch selections outside the visible set when selecting", () => {
    // 99 was selected under a previous filter and is no longer visible.
    const result = toggleAllInSelection(new Set([99]), [1, 2]);
    expect(result).toEqual(new Set([99, 1, 2]));
  });

  it("does not discard selections outside the visible set when deselecting", () => {
    const result = toggleAllInSelection(new Set([1, 2, 99]), [1, 2]);
    expect(result).toEqual(new Set([99]));
  });

  it("is a no-op deselect-to-select when the visible list is empty", () => {
    const result = toggleAllInSelection(new Set([1]), []);
    expect(result).toEqual(new Set([1]));
  });
});

describe("resolveLabelMaterials", () => {
  const materials = [
    { id: 1, name: "A" },
    { id: 2, name: "B" },
    { id: 3, name: "C" },
  ];

  it("prints all filtered materials when nothing is selected", () => {
    const filtered = materials.filter((m) => m.id !== 3);
    const result = resolveLabelMaterials(materials, filtered, new Set());
    expect(result).toEqual(filtered);
  });

  it("prints only the selected materials when a selection exists", () => {
    const result = resolveLabelMaterials(materials, materials, new Set([2]));
    expect(result).toEqual([materials[1]]);
  });

  it("keeps a selection that is currently filtered out of view", () => {
    // Material 3 was selected earlier; the active filter now hides it,
    // but it must still make it onto the printed sheet.
    const filtered = materials.filter((m) => m.id !== 3);
    const result = resolveLabelMaterials(materials, filtered, new Set([3]));
    expect(result).toEqual([materials[2]]);
  });
});
