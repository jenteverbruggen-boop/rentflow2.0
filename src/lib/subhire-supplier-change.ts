import type { SubhireCostBasis } from "@/types";

/** What the edit dialog prefills when the supplier of a hire changes: the
 * material's default price when the new supplier is its default supplier,
 * otherwise nothing (a price belongs to one supplier). Mirrors the server
 * rule in `updateSubhire`; the fixed total is always cleared. */
export function costsForSupplierChange(
  newSupplierId: number,
  material: { defaultSupplierId?: number | null; subhireUnitCost?: number | null; subhireCostBasis?: SubhireCostBasis },
  current: { basis: SubhireCostBasis },
): { basis: SubhireCostBasis; unitCost: number | null; costOverride: null } {
  if (newSupplierId === material.defaultSupplierId) {
    return {
      basis: material.subhireCostBasis ?? current.basis,
      unitCost: material.subhireUnitCost ?? null,
      costOverride: null,
    };
  }
  return { basis: current.basis, unitCost: null, costOverride: null };
}

interface PickTarget {
  mode: "hire" | "edit";
  supplierId: number | null;
  defaults?: { defaultSupplierId?: number | null; subhireUnitCost?: number | null; subhireCostBasis?: SubhireCostBasis };
  basis: SubhireCostBasis;
  unitCost: number | null;
  costOverride: number | null;
}

/** The cost fields the dialog shows after a supplier is picked. Going back to
 * the supplier the dialog opened with restores what it opened with (hire: the
 * material's prefill for its default supplier); any other supplier gets no
 * price (a price belongs to one supplier), except an edit to the material's
 * own default supplier, which takes the material's default price. */
export function costsForPick(newSupplierId: number, target: PickTarget) {
  if (newSupplierId === target.supplierId) {
    return { basis: target.basis, unitCost: target.unitCost, costOverride: target.costOverride };
  }
  if (target.mode === "hire") return { basis: target.basis, unitCost: null, costOverride: null };
  return costsForSupplierChange(newSupplierId, target.defaults ?? {}, { basis: target.basis });
}
