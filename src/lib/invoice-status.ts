/**
 * J2b.2 — netInvoicedExcl only, for now: the "already invoiced" balance
 * a final invoice's priorDeposits must deduct (design doc §5), and the
 * same non-double-counting contract K1 later reuses for its invoiced
 * stats series. resolveInvoiceDisplayStatus/remainingBalance (§6) land
 * here too once J2b.6 (payments) needs them — this file is that
 * commit's home, started early because §5 already depends on it.
 */

export interface NetInvoicedInput {
  subtotalExcl: number;
  travelExcl: number;
  deductionExcl: number;
  creditNotes?: { status: string; subtotalExcl: number; travelExcl: number; deductionExcl: number }[];
}

/**
 * A credit note's own figures are stored as true negatives (design doc
 * §4.3), so summing them in — filtered to non-concept, since a draft
 * credit note has no effect yet — nets out automatically. No special
 * casing by `kind` is needed at any call site.
 */
export function netInvoicedExcl(invoice: NetInvoicedInput): number {
  const own = invoice.subtotalExcl + invoice.travelExcl + invoice.deductionExcl;
  const credited = (invoice.creditNotes ?? [])
    .filter((cn) => cn.status !== "concept")
    .reduce((sum, cn) => sum + cn.subtotalExcl + cn.travelExcl + cn.deductionExcl, 0);
  return Math.round((own + credited) * 100) / 100;
}
