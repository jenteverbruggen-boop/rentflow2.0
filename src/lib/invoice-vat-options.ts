const BELGIAN_RATES = [0, 6, 12, 21];

/** VAT rates offered on a line: the Belgian ones plus the invoice's own
 * default (the BTW setting) when that is something else. */
export function vatOptions(defaultRate: number): number[] {
  return [...new Set([...BELGIAN_RATES, defaultRate])].sort((a, b) => a - b);
}
