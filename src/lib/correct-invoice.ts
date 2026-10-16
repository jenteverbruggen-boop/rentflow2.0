import type { PrismaClient } from "@/generated/prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { createCreditNote } from "@/lib/create-credit-note";
import { invoiceInclude } from "@/lib/serialize-invoice";
import { lockRow } from "@/lib/row-lock";

export class CorrectInvoiceError extends Error {
  code: "NOT_FOUND" | "NOT_APPLICABLE" | "NOT_SENT" | "ALREADY_CREDITED" | "ALREADY_CORRECTED" | "DEPOSIT_DEDUCTED";
  constructor(code: CorrectInvoiceError["code"], message: string) {
    super(message);
    this.code = code;
  }
}

/**
 * "Corrigeren" — the legally clean way to fix a sent invoice: it is never
 * edited. In one transaction it creates (1) a full credit note draft for the
 * original and (2) a new draft invoice that copies every line, carrying the
 * deposit role/amounts, which the PO then edits. The two are finalised
 * together (finalize-invoice.ts): a sent replacement with an unsent credit
 * note would bill the client twice.
 *
 * Refused when it would go wrong: the original isn't a sent invoice, is
 * already (partly) credited or already being corrected, or is a deposit a
 * later final invoice has deducted — correcting that retroactively changes
 * what the final invoice owes, so the final invoice has to be corrected too.
 */
export async function correctInvoice(invoiceId: number, client: PrismaClient = defaultPrisma) {
  return client.$transaction(async (tx) => {
    const txClient = tx as unknown as PrismaClient;
    // Two concurrent "Corrigeren" would each see no credit note yet and create a
    // pair; sending one pair would then over-credit the original.
    await lockRow(txClient, "Invoice", invoiceId);
    const original = await txClient.invoice.findUnique({
      where: { id: invoiceId },
      include: { lines: true, creditNotes: { select: { id: true } }, corrections: { select: { id: true } } },
    });
    if (!original) throw new CorrectInvoiceError("NOT_FOUND", "Factuur niet gevonden");
    if (original.kind !== "invoice") {
      throw new CorrectInvoiceError("NOT_APPLICABLE", "Alleen een factuur kan gecorrigeerd worden");
    }
    if (original.status === "concept") {
      throw new CorrectInvoiceError("NOT_SENT", "Een concept kan je gewoon aanpassen");
    }
    if (original.corrections.length > 0) {
      throw new CorrectInvoiceError("ALREADY_CORRECTED", "Deze factuur heeft al een correctie");
    }
    if (original.creditNotes.length > 0) {
      throw new CorrectInvoiceError(
        "ALREADY_CREDITED",
        "Deze factuur heeft al een creditnota (ook een concept telt) — verwijder die eerst of werk ermee verder",
      );
    }
    if (original.invoiceRole === "deposit" && (await isDepositDeducted(txClient, original))) {
      throw new CorrectInvoiceError(
        "DEPOSIT_DEDUCTED",
        "Dit voorschot is al in mindering gebracht op een eindfactuur — corrigeer eerst die eindfactuur",
      );
    }

    const creditNote = await createCreditNote(original.id, undefined, txClient);
    const replacement = await txClient.invoice.create({
      data: {
        kind: "invoice",
        series: "invoice",
        status: "concept",
        invoiceRole: original.invoiceRole,
        correctionOfId: original.id,
        // Still the same quote's invoice: without this the quote could be
        // converted again and the replacement could be regenerated from the
        // project, dropping the quoted lines.
        sourceQuoteId: original.sourceQuoteId,
        projectId: original.projectId,
        clientId: original.clientId,
        clientName: original.clientName,
        clientAddress: original.clientAddress,
        clientPostalCode: original.clientPostalCode,
        clientCity: original.clientCity,
        clientVatNumber: original.clientVatNumber,
        currency: original.currency,
        subtotalExcl: original.subtotalExcl,
        travelExcl: original.travelExcl,
        deductionExcl: original.deductionExcl,
        vatAmount: original.vatAmount,
        totalIncl: original.totalIncl,
        depositType: original.depositType,
        depositPercentage: original.depositPercentage,
        depositBasisExcl: original.depositBasisExcl,
        notes: original.notes,
        footer: original.footer,
        paymentTermDays: original.paymentTermDays,
        // Same lines as the original, so the "project changed" check compares
        // against what the original was generated from.
        generatedHash: original.generatedHash,
        lines: {
          create: original.lines.map((l) => ({
            section: l.section, kind: l.kind, description: l.description, quantity: l.quantity,
            unit: l.unit, unitPrice: l.unitPrice, vatRate: l.vatRate, lineTotalExcl: l.lineTotalExcl,
            sortOrder: l.sortOrder, sourceKind: l.sourceKind, sourceId: l.sourceId,
          })),
        },
      },
      include: invoiceInclude,
    });
    return { creditNote, replacement };
  });
}

/** Has any sent invoice on the project deducted this deposit? New deduction
 * lines carry the deposit's id; older ones only name its number. */
async function isDepositDeducted(
  tx: PrismaClient,
  deposit: { id: number; number: string | null; projectId: number | null },
): Promise<boolean> {
  if (deposit.projectId == null) return false;
  const deductions = await tx.invoiceLine.findMany({
    where: { kind: "deduction", invoice: { projectId: deposit.projectId, status: { not: "concept" }, kind: "invoice" } },
    select: { sourceKind: true, sourceId: true, description: true },
  });
  return deductions.some(
    (d) =>
      (d.sourceKind === "priorDeposit" && d.sourceId === deposit.id) ||
      (deposit.number != null && d.description.includes(`voorschotfactuur ${deposit.number} `)),
  );
}
