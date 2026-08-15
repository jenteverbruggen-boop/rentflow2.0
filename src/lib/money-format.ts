/**
 * BTW/currency formatting helpers, split out of pricing.ts to keep that
 * file under the 150-line limit (Y1.2) — pure move, no behaviour change.
 * Re-exported from pricing.ts so existing import sites are unaffected.
 */

export const BTW_RATE = 0.21;

export function btwAmount(amountExcl: number): number {
  return Math.round(amountExcl * BTW_RATE * 100) / 100;
}

export function withBtw(amountExcl: number): number {
  return Math.round(amountExcl * (1 + BTW_RATE) * 100) / 100;
}

/**
 * `null`/`undefined` mean the value was redacted (N2.1 — a caller without
 * Kosten/Facturen access) rather than genuinely absent or zero. Rendering
 * "—" avoids two failure modes: crashing (Intl.NumberFormat throws on
 * null) and lying (defaulting to €0,00 would look like a real free price).
 */
export function formatEUR(amount: number | null | undefined): string {
  if (amount == null) return "—";
  return new Intl.NumberFormat("nl-BE", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}
