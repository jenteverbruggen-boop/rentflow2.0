import { netInvoicedExcl, type NetInvoicedInput } from "@/lib/invoice-status";
import { monthKey } from "@/lib/stats-months";

export interface StatsInvoice extends NetInvoicedInput {
  id: number;
  kind: string;
  status: string;
  clientId: number;
  invoiceDate: Date | string | null;
}

const round = (n: number) => Math.round(n * 100) / 100;

/**
 * K1.1 — invoiced revenue is attributed to the *invoice's own month*
 * (never the period's), per the brief's own instruction that the two
 * series will not line up and the UI must not imply otherwise. Only
 * real invoices (`kind !== "creditnota"`) that have actually left
 * `concept` are counted — a credit note is never iterated over
 * directly here, since `netInvoicedExcl` already folds each invoice's
 * own linked credit notes into its net figure (design doc §5), so
 * summing invoices alone can never double-count.
 *
 * An invoice's own single month is used as its bucket (never split
 * pro-rata like the booked series) — per the brief's own fallback:
 * "if pro-rata proves impractical for the invoiced series ... bucket
 * invoices by invoice date". A single invoice has one invoiceDate, not
 * a date range, so there is nothing to split.
 */
export function aggregateInvoicedByMonth(invoices: StatsInvoice[]): Map<string, number> {
  const byMonth = new Map<string, number>();
  for (const invoice of billableInvoices(invoices)) {
    const month = monthKey(new Date(invoice.invoiceDate as string | Date));
    byMonth.set(month, round((byMonth.get(month) ?? 0) + netInvoicedExcl(invoice)));
  }
  return byMonth;
}

export function aggregateInvoicedByClient(invoices: StatsInvoice[]): Map<number, number> {
  const byClient = new Map<number, number>();
  for (const invoice of billableInvoices(invoices)) {
    byClient.set(invoice.clientId, round((byClient.get(invoice.clientId) ?? 0) + netInvoicedExcl(invoice)));
  }
  return byClient;
}

function billableInvoices(invoices: StatsInvoice[]): StatsInvoice[] {
  return invoices.filter(
    (inv) => inv.kind !== "creditnota" && inv.status !== "concept" && inv.invoiceDate != null,
  );
}
