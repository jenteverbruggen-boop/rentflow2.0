import type { DraftInvoiceLine } from "@/lib/invoice-lines";

export interface InvoiceTotals {
  subtotalExcl: number;
  travelExcl: number;
  deductionExcl: number;
  vatAmount: number;
  totalIncl: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** VAT per distinct rate, each rounded to cents. `computeInvoiceTotals`
 * sums exactly these, so the per-rate rows an invoice prints always add up
 * to its `vatAmount`. Free-text lines carry no VAT and never appear. */
export function vatByRate(
  lines: Pick<DraftInvoiceLine, "kind" | "lineTotalExcl" | "vatRate">[],
): Map<number, number> {
  const raw = new Map<number, number>();
  for (const l of lines) {
    if (l.kind === "text") continue;
    raw.set(l.vatRate, (raw.get(l.vatRate) ?? 0) + (l.lineTotalExcl * l.vatRate) / 100);
  }
  return new Map([...raw].map(([rate, amount]) => [rate, round2(amount)]));
}

/**
 * J2b.2 — rolls a set of draft/persisted lines up into the five
 * Invoice-level totals (design doc §1.1): `travel` lines feed
 * `travelExcl` (Q22 — outside the subtotal, inside the total),
 * `deduction` lines feed `deductionExcl` (already negative), and every
 * other kind (person/material/bundle/deposit/manual) feeds
 * `subtotalExcl`. `vatAmount` sums every line's own `lineTotalExcl ×
 * vatRate / 100` — never a single flat-rate calculation — so a mixed-
 * VAT invoice (not currently reachable, since one BTW setting applies
 * to every generated line, but InvoiceLine.vatRate is per-line by
 * design for future Peppol/manual-line flexibility) totals correctly.
 */
export function computeInvoiceTotals(
  lines: Pick<DraftInvoiceLine, "kind" | "lineTotalExcl" | "vatRate">[],
): InvoiceTotals {
  let subtotalExcl = 0;
  let travelExcl = 0;
  let deductionExcl = 0;

  for (const l of lines) {
    if (l.kind === "text") continue;
    if (l.kind === "travel") travelExcl += l.lineTotalExcl;
    else if (l.kind === "deduction") deductionExcl += l.lineTotalExcl;
    else subtotalExcl += l.lineTotalExcl;
  }

  const round = round2;
  subtotalExcl = round(subtotalExcl);
  travelExcl = round(travelExcl);
  deductionExcl = round(deductionExcl);
  const vatAmount = round([...vatByRate(lines).values()].reduce((a, b) => a + b, 0));
  const totalIncl = round(subtotalExcl + travelExcl + deductionExcl + vatAmount);

  return { subtotalExcl, travelExcl, deductionExcl, vatAmount, totalIncl };
}
