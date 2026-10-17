import type { PriceBasis } from "@/types";

/** "/d" for a per-day price, "/huur" for a per-rental one. */
export function basisSuffix(basis: PriceBasis | string | null | undefined): string {
  return basis === "per_huur" ? "/huur" : "/d";
}

/** The "units × days × price" calculation text of a material line; a
 * per-rental price has no day factor. */
export function calcText(units: number, days: number, basis: PriceBasis | string | null | undefined, price: string): string {
  return basis === "per_huur" ? `${units} × ${price}` : `${units} × ${days} × ${price}`;
}
