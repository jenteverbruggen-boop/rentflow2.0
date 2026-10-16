import { describe, it, expect } from "vitest";
import { summarizePeriodMaterials, MAX_MATERIAL_LINES, type MaterialEntry } from "@/lib/calendar-feed-materials";

const e = (over: Partial<MaterialEntry>): MaterialEntry => ({
  materialId: 1, name: "Tent 6x3", category: "Tenten", quantity: 1, isSet: false, ...over,
});

describe("summarizePeriodMaterials (C7)", () => {
  it("counts units per material as 'Nx name'", () => {
    expect(summarizePeriodMaterials([e({}), e({}), e({})])).toEqual(["3x Tent 6x3"]);
  });

  it("merges rows of the same material (e.g. booked at different prices)", () => {
    expect(summarizePeriodMaterials([e({ quantity: 2 }), e({ quantity: 3 })])).toEqual(["5x Tent 6x3"]);
  });

  it("marks a booked set and counts it by its own quantity", () => {
    expect(summarizePeriodMaterials([e({ materialId: 9, name: "Geluidset", category: "Geluid", quantity: 2, isSet: true })]))
      .toEqual(["2x Geluidset (set)"]);
  });

  it("sorts by category, then name", () => {
    const lines = summarizePeriodMaterials([
      e({ materialId: 3, name: "Zetel", category: "Meubilair" }),
      e({ materialId: 2, name: "Tafel", category: "Meubilair" }),
      e({ materialId: 1, name: "Tent", category: "Tenten" }),
      e({ materialId: 4, name: "Kabel", category: null }),
    ]);
    expect(lines).toEqual(["1x Tafel", "1x Zetel", "1x Kabel", "1x Tent"]);
  });

  it("drops zero quantities", () => {
    expect(summarizePeriodMaterials([e({ quantity: 0 })])).toEqual([]);
  });

  it("caps a long list and says how many were left out", () => {
    const entries = Array.from({ length: MAX_MATERIAL_LINES + 4 }, (_, i) =>
      e({ materialId: i + 1, name: `Item ${String(i).padStart(2, "0")}` }),
    );
    const lines = summarizePeriodMaterials(entries);
    expect(lines).toHaveLength(MAX_MATERIAL_LINES + 1);
    expect(lines.at(-1)).toBe("… en 4 meer");
  });
});
