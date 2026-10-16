import type { Prisma } from "@/generated/prisma/client";
import { toNumber, toNumberOrNull } from "@/lib/serialize";
import { resolveInvoiceDisplayStatus, remainingBalance } from "@/lib/invoice-status";

export const invoiceInclude = {
  lines: true,
  payments: true,
  creditNotes: true,
  // A credit note must name the invoice it corrects (number + date).
  creditNoteOf: { select: { number: true, invoiceDate: true, corrections: { select: { id: true, number: true, status: true } } } },
  // C1b — the invoice a replacement replaces, and the replacement of a corrected one.
  correctionOf: { select: { number: true } },
  sourceQuote: { select: { number: true } },
  // "Betreft": what the document is about, printed under the billing address.
  project: { select: { name: true, startDate: true, endDate: true, location: true, locationRel: { select: { name: true } } } },
  corrections: { select: { id: true, number: true, status: true } },
} satisfies Prisma.InvoiceInclude;
type InvoiceWithLines = Prisma.InvoiceGetPayload<{ include: typeof invoiceInclude }>;
type InvoiceLine = Prisma.InvoiceLineGetPayload<Record<string, never>>;
type Payment = Prisma.PaymentGetPayload<Record<string, never>>;

/** J2b.6 — POST/PATCH .../payments(/:paymentId) return just the
 * payment (design doc §7), not the whole invoice. */
export function serializePayment(payment: Payment) {
  return { ...payment, amount: toNumber(payment.amount) };
}

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
 * J2b.2/J2b.6 — converts every Decimal-typed field to a plain number
 * (Money rule) and adds the two computed, never-persisted fields the
 * wire type requires (design doc §1.3): `displayStatus` (full §6.2
 * priority-table derivation) and `remainingBalance` (§6.1, netted
 * against linked non-concept credit notes).
 */
export function serializeInvoice(invoice: InvoiceWithLines) {
  const subtotalExcl = toNumber(invoice.subtotalExcl);
  const travelExcl = toNumber(invoice.travelExcl);
  const deductionExcl = toNumber(invoice.deductionExcl);
  const vatAmount = toNumber(invoice.vatAmount);
  const totalIncl = toNumber(invoice.totalIncl);
  const creditNotes = invoice.creditNotes.map((cn) => ({
    ...cn,
    subtotalExcl: toNumber(cn.subtotalExcl),
    travelExcl: toNumber(cn.travelExcl),
    deductionExcl: toNumber(cn.deductionExcl),
    vatAmount: toNumber(cn.vatAmount),
    totalIncl: toNumber(cn.totalIncl),
  }));
  const payments = invoice.payments.map((p) => ({ ...p, amount: toNumber(p.amount) }));
  const statusInput = {
    kind: invoice.kind,
    status: invoice.status,
    totalIncl,
    dueDate: invoice.dueDate,
    validUntil: invoice.validUntil,
    creditNotes,
    payments,
  };

  return {
    ...invoice,
    subtotalExcl,
    travelExcl,
    deductionExcl,
    vatAmount,
    totalIncl,
    correctionOfNumber: invoice.correctionOf?.number ?? null,
    sourceQuoteNumber: invoice.sourceQuote?.number ?? null,
    projectName: invoice.project?.name ?? null,
    projectStartDate: invoice.project?.startDate.toISOString() ?? null,
    projectEndDate: invoice.project?.endDate.toISOString() ?? null,
    projectLocation: invoice.project?.locationRel?.name ?? invoice.project?.location ?? null,
    correctedBy: invoice.corrections[0] ?? null,
    // On a credit note: the replacement it is sent together with (if any).
    correctionReplacement: invoice.creditNoteOf?.corrections[0] ?? null,
    creditNoteOfNumber: invoice.creditNoteOf?.number ?? null,
    creditNoteOfDate: invoice.creditNoteOf?.invoiceDate?.toISOString() ?? null,
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
    payments,
    creditNotes,
    displayStatus: resolveInvoiceDisplayStatus(statusInput),
    remainingBalance: remainingBalance(statusInput),
  };
}
