import { describe, it, expect } from "vitest";
import { costsForSupplierChange } from "@/lib/subhire-supplier-change";

const material = { defaultSupplierId: 1, subhireUnitCost: 2.5, subhireCostBasis: "per_dag" as const };

describe("costsForSupplierChange", () => {
  it("uses the material default for its default supplier", () => {
    expect(costsForSupplierChange(1, material, { basis: "per_huur" })).toEqual({ basis: "per_dag", unitCost: 2.5, costOverride: null });
  });
  it("clears the price for another supplier", () => {
    expect(costsForSupplierChange(2, material, { basis: "per_huur" })).toEqual({ basis: "per_huur", unitCost: null, costOverride: null });
  });
});
