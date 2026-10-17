import { describe, it, expect } from "vitest";
import { costsForSupplierChange, costsForPick } from "@/lib/subhire-supplier-change";

const material = { defaultSupplierId: 1, subhireUnitCost: 2.5, subhireCostBasis: "per_dag" as const };

describe("costsForSupplierChange", () => {
  it("uses the material default for its default supplier", () => {
    expect(costsForSupplierChange(1, material, { basis: "per_huur" })).toEqual({ basis: "per_dag", unitCost: 2.5, costOverride: null });
  });
  it("clears the price for another supplier", () => {
    expect(costsForSupplierChange(2, material, { basis: "per_huur" })).toEqual({ basis: "per_huur", unitCost: null, costOverride: null });
  });
});

describe("costsForPick", () => {
  const edit = { mode: "edit" as const, supplierId: 5, defaults: material, basis: "per_dag" as const, unitCost: 7, costOverride: 40 };
  it("restores the original price when switching back (edit)", () => {
    expect(costsForPick(2, edit)).toMatchObject({ unitCost: null, costOverride: null });
    expect(costsForPick(5, edit)).toEqual({ basis: "per_dag", unitCost: 7, costOverride: 40 });
  });
  it("hire: default supplier keeps the prefill, another supplier clears it", () => {
    const hire = { mode: "hire" as const, supplierId: 1, basis: "per_huur" as const, unitCost: 2.5, costOverride: null };
    expect(costsForPick(3, hire).unitCost).toBeNull();
    expect(costsForPick(1, hire).unitCost).toBe(2.5);
  });
});
