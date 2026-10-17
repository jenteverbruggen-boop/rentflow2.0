import { describe, it, expect } from "vitest";
import { noSellingPrice, sellAtOrBelowCost } from "@/lib/price-warnings";

describe("price warnings (E3)", () => {
  it("flags a flat material with a zero price, not a hidden or set price", () => {
    expect(noSellingPrice({ dayPrice: 0, isBundle: false })).toBe(true);
    expect(noSellingPrice({ dayPrice: 3, isBundle: false })).toBe(false);
    expect(noSellingPrice({ dayPrice: null as never, isBundle: false })).toBe(false);
    expect(noSellingPrice({ dayPrice: 0, isBundle: true })).toBe(false);
  });
  it("flags inhuur-only items sold at or below their purchase price", () => {
    const m = { isBundle: false, subhireOnly: true, subhireUnitCost: 5, dayPrice: 5 };
    expect(sellAtOrBelowCost(m)).toBe(true);
    expect(sellAtOrBelowCost({ ...m, dayPrice: 6 })).toBe(false);
    expect(sellAtOrBelowCost({ ...m, dayPrice: 0 })).toBe(false);
    expect(sellAtOrBelowCost({ ...m, subhireUnitCost: null })).toBe(false);
    expect(sellAtOrBelowCost({ ...m, subhireOnly: false })).toBe(false);
  });
});
