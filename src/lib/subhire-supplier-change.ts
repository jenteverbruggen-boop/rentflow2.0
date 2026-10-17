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
