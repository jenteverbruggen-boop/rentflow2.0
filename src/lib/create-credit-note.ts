import type { PrismaClient } from "@/generated/prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { computeInvoiceTotals } from "@/lib/invoice-totals";
import { invoiceInclude } from "@/lib/serialize-invoice";
import { toNumber } from "@/lib/serialize";
import type { InvoiceLineKind } from "@/types";

export interface CreditNoteLineInput {
  lineId: number;
  quantity?: number;
}

export class CreditNoteError extends Error {
  code: "NOT_FOUND" | "NOT_SENT" | "ALREADY_CREDIT_NOTE" | "INVALID_QUANTITY" | "LINE_NOT_FOUND";
  constructor(code: CreditNoteError["code"], message: string) {
    super(message);
    this.code = code;
  }
}

/**
 * J2b.5 (invoice-design.md §7, §4.3) — a correction always creates a
 * new, separate draft `Invoice` (`kind: "creditnota"`, own `credit`
 * series) rather than touching the original — the original is never
 * written to, its link to the credit note visible only via the
 * `creditNotes` relation. Omitting `lines` mirrors every original line
 * in full; providing `lines` credits only those, each capped at its
 * own original quantity (design doc §12 open risk 5). Amounts are
 * stored as true negatives (quantity negated, `lineTotalExcl`
 * recomputed), so any later `SUM` over an invoice and its credit notes
 * nets automatically — no `kind` special-casing at the call site
 * (§5's `netInvoicedExcl`).
 *
 * Returns a draft (`status: "concept"`) — it goes through the same
 * `finalize` endpoint as any other invoice (J2b.3) to be numbered on
 * the `credit` series, letting the PO review it first.
 */
export async function createCreditNote(
  invoiceId: number,
  lines: CreditNoteLineInput[] | undefined,
  client: PrismaClient = defaultPrisma,
) {
  const original = await client.invoice.findUnique({
    where: { id: invoiceId },
    include: { lines: true },
  });
  if (!original) throw new CreditNoteError("NOT_FOUND", "Factuur niet gevonden");
  if (original.kind === "creditnota") {
    throw new CreditNoteError("ALREADY_CREDIT_NOTE", "Een creditnota kan zelf niet gecrediteerd worden");
  }
  if (original.status === "concept") {
    throw new CreditNoteError("NOT_SENT", "Alleen verzonden facturen kunnen gecrediteerd worden");
  }

  const inputLines: CreditNoteLineInput[] =
    lines ?? original.lines.map((l) => ({ lineId: l.id, quantity: undefined }));
  const creditLines = inputLines.map((entry) => {
    const source = original.lines.find((l) => l.id === entry.lineId);
    if (!source) throw new CreditNoteError("LINE_NOT_FOUND", `Regel ${entry.lineId} bestaat niet op deze factuur`);
    const sourceQuantity = toNumber(source.quantity);
    const quantity = entry.quantity ?? sourceQuantity;
    if (quantity <= 0 || quantity > sourceQuantity) {
      throw new CreditNoteError(
        "INVALID_QUANTITY",
        `Aantal voor regel ${entry.lineId} moet tussen 0 en ${sourceQuantity} liggen`,
      );
    }
    const unitPrice = toNumber(source.unitPrice);
    return {
      section: source.section,
      kind: source.kind as InvoiceLineKind,
      description: source.description,
      quantity: -quantity,
      unit: source.unit,
      unitPrice,
      vatRate: toNumber(source.vatRate),
      lineTotalExcl: -Math.round(quantity * unitPrice * 100) / 100,
      sortOrder: source.sortOrder,
      sourceKind: "creditedLine",
      sourceId: source.id,
    };
  });
  const totals = computeInvoiceTotals(creditLines);

  return client.invoice.create({
    data: {
      kind: "creditnota",
      series: "credit",
      status: "concept",
      creditNoteOfId: original.id,
      projectId: original.projectId,
      clientId: original.clientId,
      clientName: original.clientName,
      clientAddress: original.clientAddress,
      clientPostalCode: original.clientPostalCode,
      clientCity: original.clientCity,
      clientVatNumber: original.clientVatNumber,
      ...totals,
      lines: { create: creditLines },
    },
    include: invoiceInclude,
  });
}
