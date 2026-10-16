import type { PrismaClient } from "@/generated/prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { nextInvoiceSequence, formatInvoiceNumber, brusselsYear } from "@/lib/invoice-numbering";
import { invoiceInclude } from "@/lib/serialize-invoice";
import { structuredReference } from "@/lib/invoice-reference";
import { syncStatus } from "@/lib/invoice-payments";
import { assertInvoiceable } from "@/lib/invoice-guards";

type FinalizeErrorCode = "NOT_FOUND" | "ALREADY_FINALIZED" | "CORRECTION_INCOMPLETE" | "NOT_AN_INVOICE";

export class FinalizeInvoiceError extends Error {
  code: FinalizeErrorCode;
  constructor(code: FinalizeErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

const DEFAULT_FORMAT = "{year}-{seq:04d}";
const DEFAULT_TERM_DAYS = 30;

/**
 * J2b.3/J2b.4 — the `concept → verzonden` transition (design doc §3):
 * everything freezes at once, inside one transaction. `series` is
 * derived from `kind` so this same endpoint already supports credit
 * notes once J2b.5 creates them (`kind: "creditnota"` → `series:
 * "credit"`, its own independent counter row) — no rework needed then.
 */
/** Only invoices and credit notes draw a legal number. A quote on the invoice
 * series would punch a hole in the gapless sequence (design §0.10), so it has
 * its own `sendQuote` and is refused here. */
function assertNumberable(kind: string): void {
  if (kind !== "invoice" && kind !== "creditnota") {
    throw new FinalizeInvoiceError("NOT_AN_INVOICE", "Een offerte wordt verzonden, niet gefinaliseerd");
  }
}

async function finalizeInTx(txClient: PrismaClient, id: number) {
  const invoice = await txClient.invoice.findUnique({ where: { id } });
  if (!invoice) throw new FinalizeInvoiceError("NOT_FOUND", "Factuur niet gevonden");
  assertNumberable(invoice.kind);
  if (invoice.status !== "concept") {
    throw new FinalizeInvoiceError("ALREADY_FINALIZED", "Factuur is al verzonden — niet meer te wijzigen");
  }

  // A correction's replacement only copies lines that were already billed, so
  // overbooking added to the project since then is no reason to block it.
  if (invoice.kind === "invoice" && invoice.projectId != null && invoice.correctionOfId == null) {
    await assertInvoiceable(invoice.projectId, txClient);
  }

  const settingRows = await txClient.setting.findMany({
    where: { key: { in: ["invoiceNumberFormat", "invoicePaymentTermDays"] } },
  });
  const settings = new Map(settingRows.map((r) => [r.key, r.value ?? ""]));
  const format = settings.get("invoiceNumberFormat") || DEFAULT_FORMAT;
  // A per-invoice term (set on the draft) wins over the company setting.
  const termDays =
    invoice.paymentTermDays ?? (Number(settings.get("invoicePaymentTermDays")) || DEFAULT_TERM_DAYS);

  const series = invoice.kind === "creditnota" ? "credit" : "invoice";
  const now = new Date();
  const year = brusselsYear(now);
  const seq = await nextInvoiceSequence(txClient, series, year);
  const number = formatInvoiceNumber(format, series, year, seq);
  const dueDate = new Date(now.getTime() + termDays * 86_400_000);

  // Credit notes take no payments, so only invoices get an OGM — and the
  // credit series' own year+seq would collide with the invoice series'.
  const paymentReference = series === "invoice" ? structuredReference(year, seq) : undefined;

  return txClient.invoice.update({
    where: { id },
    data: {
      number, year, series, status: "verzonden", invoiceDate: now, dueDate, finalizedAt: now,
      ...(paymentReference ? { paymentReference } : {}),
    },
    include: invoiceInclude,
  });
}

type CorrectionPair = { originalId: number; creditNoteId: number; replacementId: number };

/** The other half of a correction ("Corrigeren"): a replacement invoice and the
 * credit note that cancels the invoice it replaces are sent together or not at
 * all. Finalising only the replacement would bill the client twice. */
async function findCorrectionPair(
  tx: PrismaClient,
  invoice: { id: number; kind: string; correctionOfId: number | null; creditNoteOfId: number | null },
): Promise<CorrectionPair | null> {
  if (invoice.correctionOfId != null) {
    const cn = await tx.invoice.findFirst({
      where: { creditNoteOfId: invoice.correctionOfId, kind: "creditnota" },
      orderBy: { id: "desc" },
    });
    if (cn?.status === "concept") {
      return { originalId: invoice.correctionOfId, creditNoteId: cn.id, replacementId: invoice.id };
    }
    if (!cn) {
      throw new FinalizeInvoiceError(
        "CORRECTION_INCOMPLETE",
        "De creditnota van deze correctie ontbreekt — de oorspronkelijke factuur zou dubbel aangerekend worden",
      );
    }
    return null; // the credit note is already out: this is just the replacement going out
  }
  if (invoice.kind === "creditnota" && invoice.creditNoteOfId != null) {
    const replacement = await tx.invoice.findFirst({
      where: { correctionOfId: invoice.creditNoteOfId, status: "concept" },
    });
    if (replacement) {
      return { originalId: invoice.creditNoteOfId, creditNoteId: invoice.id, replacementId: replacement.id };
    }
  }
  return null;
}

/** Credit note first (its own series), then the replacement; any payments on
 * the credited original move to the replacement, since that is what is owed. */
async function finalizePair(tx: PrismaClient, pair: CorrectionPair): Promise<void> {
  await finalizeInTx(tx, pair.creditNoteId);
  await finalizeInTx(tx, pair.replacementId);
  await tx.payment.updateMany({ where: { invoiceId: pair.originalId }, data: { invoiceId: pair.replacementId } });
  await syncStatus(tx, pair.originalId);
  await syncStatus(tx, pair.replacementId);
}

export async function finalizeInvoice(id: number, client: PrismaClient = defaultPrisma) {
  return client.$transaction(async (tx) => {
    const txClient = tx as unknown as PrismaClient;
    const invoice = await txClient.invoice.findUnique({ where: { id } });
    if (!invoice) throw new FinalizeInvoiceError("NOT_FOUND", "Factuur niet gevonden");
    assertNumberable(invoice.kind);
    if (invoice.status !== "concept") {
      throw new FinalizeInvoiceError("ALREADY_FINALIZED", "Factuur is al verzonden — niet meer te wijzigen");
    }
    const pair = await findCorrectionPair(txClient, invoice);
    if (!pair) return finalizeInTx(txClient, id);

    await finalizePair(txClient, pair);
    return txClient.invoice.findUniqueOrThrow({ where: { id }, include: invoiceInclude });
  });
}
