import type { SubhireCostBasis } from "@/types";

/** Who a shortage created at booking time is hired in from, and at what price. */
export interface ShortageSubhire {
  supplierId: number;
  basis: SubhireCostBasis;
  unitCost: number | null;
  costOverride: number | null;
}

export interface SubhireRequest {
  supplierId?: number;
  basis?: SubhireCostBasis;
  unitCost?: number | null;
  costOverride?: number | null;
}

interface MaterialSubhireDefaults {
  subhireOnly: boolean;
  defaultSupplierId: number | null;
  subhireCostBasis: string;
  subhireUnitCost: unknown;
}

const asBasis = (b: string): SubhireCostBasis => (b === "per_dag" ? "per_dag" : "per_huur");

/**
 * Decides, at booking time, whether the units a material is short will be
 * hired in right away. An "inhuur-only" material always is, from its default
 * supplier (booking it must never leave an open shortage behind); any other
 * material only when the caller named a supplier. The supplier's price comes
 * from the request only for a caller who may see money — otherwise the
 * material's own defaults apply. `null` = leave the shortage open.
 */
export function resolveBookingSubhire(
  material: MaterialSubhireDefaults,
  request: SubhireRequest | undefined,
  canSetCosts: boolean,
): ShortageSubhire | null {
  const supplierId = material.subhireOnly ? material.defaultSupplierId : (request?.supplierId ?? null);
  if (supplierId == null) return null;
  const own = canSetCosts && request && request.supplierId === supplierId ? request : undefined;
  const defaultUnit = material.subhireUnitCost == null ? null : Number(material.subhireUnitCost);
  return {
    supplierId,
    basis: own?.basis ?? asBasis(material.subhireCostBasis),
    unitCost: own?.unitCost !== undefined ? own.unitCost : defaultUnit,
    costOverride: own?.costOverride ?? null,
  };
}
