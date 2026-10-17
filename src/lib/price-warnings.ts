import type { Material } from "@/types";

type PriceFields = Pick<Material, "dayPrice" | "isBundle" | "subhireOnly" | "subhireUnitCost" | "priceBasis" | "subhireCostBasis">;

/** True when a (non-set) material would bill the client €0. `null` means the
 * price is hidden from this caller (no Kosten/Facturen), which is not "free". */
export function noSellingPrice(m: Pick<PriceFields, "dayPrice" | "isBundle">): boolean {
  return !m.isBundle && m.dayPrice === 0;
}

/** Inhuur-only item sold for no more than it costs (money users only: the
 * purchase price is `null` for everyone else, so this stays false). Only
 * comparable when both prices are per the same unit (per day vs per rental
 * says nothing about margin). */
export function sellAtOrBelowCost(m: PriceFields): boolean {
  if ((m.priceBasis ?? "per_dag") !== (m.subhireCostBasis ?? "per_huur")) return false;
  return (
    !!m.subhireOnly && !m.isBundle && m.subhireUnitCost != null && m.dayPrice != null && m.dayPrice > 0 && m.dayPrice <= m.subhireUnitCost
  );
}
