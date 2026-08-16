import type { DraftInvoiceLine } from "@/lib/invoice-lines";

export interface InvoiceTotals {
  subtotalExcl: number;
  travelExcl: number;
  deductionExcl: number;
  vatAmount: number;
  totalIncl: number;
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
  let vatAmount = 0;

  for (const l of lines) {
    if (l.kind === "travel") travelExcl += l.lineTotalExcl;
    else if (l.kind === "deduction") deductionExcl += l.lineTotalExcl;
    else subtotalExcl += l.lineTotalExcl;
    vatAmount += (l.lineTotalExcl * l.vatRate) / 100;
  }

  const round = (n: number) => Math.round(n * 100) / 100;
  subtotalExcl = round(subtotalExcl);
  travelExcl = round(travelExcl);
  deductionExcl = round(deductionExcl);
  vatAmount = round(vatAmount);
  const totalIncl = round(subtotalExcl + travelExcl + deductionExcl + vatAmount);

  return { subtotalExcl, travelExcl, deductionExcl, vatAmount, totalIncl };
}
