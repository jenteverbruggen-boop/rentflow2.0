import type { InvoiceDisplayStatus } from "@/types";

/**
 * J2b.2/J2b.6 — netInvoicedExcl (§5) landed first since the deposit/
 * final generator depends on it; resolveInvoiceDisplayStatus/
 * remainingBalance (§6) land now that payments exist to derive them
 * from.
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

export interface StatusInput {
  kind: string;
  status: string;
  totalIncl: number;
  dueDate: string | Date | null;
  creditNotes?: { status: string; totalIncl: number }[];
  payments?: { amount: number }[];
}

/** §6.1 — what a non-concept, non-credit-note invoice is truly owed:
 * its own totalIncl, netted against every non-concept linked credit
 * note's own (already-negative) totalIncl. */
export function effectiveOwed(invoice: StatusInput): number {
  const credited = (invoice.creditNotes ?? [])
    .filter((cn) => cn.status !== "concept")
    .reduce((sum, cn) => sum + cn.totalIncl, 0);
  return Math.round((invoice.totalIncl + credited) * 100) / 100;
}

/** May go negative on overpayment — surfaced, never clamped to 0. */
export function remainingBalance(invoice: StatusInput): number {
  const paid = (invoice.payments ?? []).reduce((sum, p) => sum + p.amount, 0);
  return Math.round((effectiveOwed(invoice) - paid) * 100) / 100;
}

/**
 * §6.2 — `gedeeltelijk_betaald`/`vervallen` are never persisted (both
 * are time- and arithmetic-dependent); this derives them fresh on
 * every read. First match wins.
 */
export function resolveInvoiceDisplayStatus(
  invoice: StatusInput,
  now: Date = new Date(),
): InvoiceDisplayStatus {
  if (invoice.kind === "creditnota") return "creditnota";
  if (invoice.status === "concept") return "concept";
  if (invoice.status === "betaald") return "betaald";

  const owed = effectiveOwed(invoice);
  const balance = remainingBalance(invoice);
  const isOverdue = invoice.dueDate != null && new Date(invoice.dueDate) < now;

  if (invoice.status === "verzonden" && isOverdue && balance > 0) return "vervallen";
  if (invoice.status === "verzonden" && balance > 0 && balance < owed) return "gedeeltelijk_betaald";
  return "verzonden";
}
