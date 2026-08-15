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

export function formatEUR(amount: number): string {
  return new Intl.NumberFormat("nl-BE", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}
