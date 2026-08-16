import type { Prisma } from "@/generated/prisma/client";
import { toNumber, toNumberOrNull } from "@/lib/serialize";

export const invoiceInclude = {
  lines: true,
  payments: true,
  creditNotes: true,
} satisfies Prisma.InvoiceInclude;
type InvoiceWithLines = Prisma.InvoiceGetPayload<{ include: typeof invoiceInclude }>;
type InvoiceLine = Prisma.InvoiceLineGetPayload<Record<string, never>>;

/** J2b.4 — POST/PATCH .../lines(/:lineId) return just the line (design
 * doc §7), not the whole invoice. */
export function serializeInvoiceLine(line: InvoiceLine) {
  return {
    ...line,
    quantity: toNumber(line.quantity),
    unitPrice: toNumber(line.unitPrice),
    vatRate: toNumber(line.vatRate),
    lineTotalExcl: toNumber(line.lineTotalExcl),
  };
}

/**
 * J2b.2 — converts every Decimal-typed field to a plain number (Money
 * rule) and adds the two computed, never-persisted fields the wire type
 * requires (design doc §1.3): `displayStatus` and `remainingBalance`.
 *
 * Both are intentionally minimal here — `displayStatus` is just
 * `status` (mapped to `"creditnota"` for a credit note) with no
 * vervallen/gedeeltelijk_betaald derivation yet, and `remainingBalance`
 * ignores credit notes not linked at read time — because that full
 * derivation (design doc §6) is J2b.6's job, once payments exist to
 * derive it from. A freshly created draft or unpaid invoice reports
 * correctly either way; this is extended, not replaced, when J2b.6
 * lands.
 */
export function serializeInvoice(invoice: InvoiceWithLines) {
  const subtotalExcl = toNumber(invoice.subtotalExcl);
  const travelExcl = toNumber(invoice.travelExcl);
  const deductionExcl = toNumber(invoice.deductionExcl);
  const vatAmount = toNumber(invoice.vatAmount);
  const totalIncl = toNumber(invoice.totalIncl);
  const paid = invoice.payments.reduce((sum, p) => sum + toNumber(p.amount), 0);

  return {
    ...invoice,
    subtotalExcl,
    travelExcl,
    deductionExcl,
    vatAmount,
    totalIncl,
    depositPercentage: toNumberOrNull(invoice.depositPercentage),
    depositBasisExcl: toNumberOrNull(invoice.depositBasisExcl),
    lines: invoice.lines
      .map((l) => ({
        ...l,
        quantity: toNumber(l.quantity),
        unitPrice: toNumber(l.unitPrice),
        vatRate: toNumber(l.vatRate),
        lineTotalExcl: toNumber(l.lineTotalExcl),
      }))
      .sort((a, b) => a.sortOrder - b.sortOrder),
    payments: invoice.payments.map((p) => ({ ...p, amount: toNumber(p.amount) })),
    creditNotes: invoice.creditNotes.map((cn) => ({
      ...cn,
      subtotalExcl: toNumber(cn.subtotalExcl),
      travelExcl: toNumber(cn.travelExcl),
      deductionExcl: toNumber(cn.deductionExcl),
      vatAmount: toNumber(cn.vatAmount),
      totalIncl: toNumber(cn.totalIncl),
    })),
    displayStatus: invoice.kind === "creditnota" ? "creditnota" : invoice.status,
    remainingBalance: Math.round((totalIncl - paid) * 100) / 100,
  };
}
