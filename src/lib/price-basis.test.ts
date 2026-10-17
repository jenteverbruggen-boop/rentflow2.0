import { describe, it, expect } from "vitest";
import { basisSuffix, calcText } from "@/lib/price-basis";

describe("price-basis labels", () => {
  it("suffixes", () => {
    expect(basisSuffix("per_huur")).toBe("/huur");
    expect(basisSuffix("per_dag")).toBe("/d");
    expect(basisSuffix(undefined)).toBe("/d");
  });
  it("calculation text", () => {
    expect(calcText(2, 3, "per_dag", "€4")).toBe("2 × 3 × €4");
    expect(calcText(2, 3, "per_huur", "€4")).toBe("2 × €4");
  });
});
