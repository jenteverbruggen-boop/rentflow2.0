import { describe, it, expect } from "vitest";
import { computeBundleStock } from "@/lib/bundle-stock";
import type { BundleStockComponentInput } from "@/types";

function comp(
  overrides: Partial<BundleStockComponentInput> &
    Pick<BundleStockComponentInput, "needPerSet" | "totalStock">,
): BundleStockComponentInput {
  return {
    childId: 1,
    name: "Onderdeel",
    code: null,
    dayPrice: 0,
    ...overrides,
  };
}

describe("computeBundleStock", () => {
  it("returns empty for a bundle without components", () => {
    expect(computeBundleStock([])).toEqual({
      completeSets: 0,
      hasIncomplete: false,
      componentSum: 0,
      components: [],
    });
  });

  it("auto-calculates sets: tafel + hoes, 10 each => 10 sets, no remainder", () => {
    const result = computeBundleStock([
      comp({ childId: 1, name: "Tafel", needPerSet: 1, totalStock: 10 }),
      comp({ childId: 2, name: "Hoes", needPerSet: 1, totalStock: 10 }),
    ]);
    expect(result.completeSets).toBe(10);
    expect(result.hasIncomplete).toBe(false);
  });

  it("limits sets to the scarcest component (10 tafels, 5 hoezen => 5 sets)", () => {
    const result = computeBundleStock([
      comp({ childId: 1, name: "Tafel", needPerSet: 1, totalStock: 10 }),
      comp({ childId: 2, name: "Hoes", needPerSet: 1, totalStock: 5 }),
    ]);
    expect(result.completeSets).toBe(5);
    expect(result.hasIncomplete).toBe(true);
    const tafel = result.components.find((c) => c.childId === 1)!;
    expect(tafel.remaining).toBe(5);
    expect(tafel.missingForNext).toBe(0);
  });

  it("box of 24 glasses: 2 boxes + 50 glasses => 2 complete sets, no incomplete", () => {
    const result = computeBundleStock([
      comp({ childId: 1, name: "Doos", needPerSet: 1, totalStock: 2 }),
      comp({ childId: 2, name: "Glas", needPerSet: 24, totalStock: 50 }),
    ]);
    expect(result.completeSets).toBe(2);
    // remainder: 0 boxes, 2 glasses => an incomplete set is forming
    expect(result.hasIncomplete).toBe(true);
    const glas = result.components.find((c) => c.childId === 2)!;
    expect(glas.remaining).toBe(2);
    expect(glas.haveForNext).toBe(2);
    expect(glas.missingForNext).toBe(22);
  });

  it("3 boxes + 50 glasses => 2 complete + 1 incomplete missing 22 glasses", () => {
    const result = computeBundleStock([
      comp({ childId: 1, name: "Doos", needPerSet: 1, totalStock: 3 }),
      comp({ childId: 2, name: "Glas", needPerSet: 24, totalStock: 50 }),
    ]);
    expect(result.completeSets).toBe(2);
    expect(result.hasIncomplete).toBe(true);
    const doos = result.components.find((c) => c.childId === 1)!;
    expect(doos.haveForNext).toBe(1);
    expect(doos.missingForNext).toBe(0);
    const glas = result.components.find((c) => c.childId === 2)!;
    expect(glas.haveForNext).toBe(2);
    expect(glas.missingForNext).toBe(22);
  });

  it("computes the live price sum of one set", () => {
    const result = computeBundleStock([
      comp({ needPerSet: 2, totalStock: 10, dayPrice: 1.5 }),
      comp({ childId: 2, needPerSet: 1, totalStock: 10, dayPrice: 4 }),
    ]);
    expect(result.componentSum).toBe(7);
  });

  it("a zero-stock component blocks complete sets but still flags what's missing", () => {
    const result = computeBundleStock([
      comp({ childId: 1, name: "Tafel", needPerSet: 1, totalStock: 3 }),
      comp({ childId: 2, name: "Hoes", needPerSet: 1, totalStock: 0 }),
    ]);
    expect(result.completeSets).toBe(0);
    expect(result.hasIncomplete).toBe(true);
    const hoes = result.components.find((c) => c.childId === 2)!;
    expect(hoes.missingForNext).toBe(1);
  });
});
