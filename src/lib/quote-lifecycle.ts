import type { PrismaClient } from "@/generated/prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { nextInvoiceSequence, formatInvoiceNumber, brusselsYear } from "@/lib/invoice-numbering";
import { invoiceInclude } from "@/lib/serialize-invoice";
import { QuoteError } from "@/lib/quote-error";
import { lockRow } from "@/lib/row-lock";

const DEFAULT_FORMAT = "OF-{year}-{seq:04d}";
const DEFAULT_VALIDITY_DAYS = 30;

async function loadQuote(tx: PrismaClient, id: number) {
  const quote = await tx.invoice.findUnique({ where: { id } });
  if (!quote) throw new QuoteError("NOT_FOUND", "Offerte niet gevonden");
  if (quote.kind !== "offerte") throw new QuoteError("NOT_A_QUOTE", "Dit is geen offerte");
  return quote;
}

/**
 * concept → verzonden. The number (own `quote` series, `quoteNumberFormat`)
 * is allocated on the first send only: a quote reopened for edits keeps it.
 * `validUntil` is the send date plus the validity term — the draft's own
 * `paymentTermDays` if set, else the `quoteValidityDays` setting.
 */
export async function sendQuote(id: number, client: PrismaClient = defaultPrisma) {
  return client.$transaction(async (tx) => {
    const txClient = tx as unknown as PrismaClient;
    await lockRow(txClient, "Invoice", id);
    const quote = await loadQuote(txClient, id);
    if (quote.status !== "concept") throw new QuoteError("WRONG_STATUS", "Alleen een concept-offerte kan verzonden worden");

    const settings = new Map(
      (await txClient.setting.findMany({ where: { key: { in: ["quoteNumberFormat", "quoteValidityDays"] } } }))
        .map((r) => [r.key, r.value ?? ""]),
    );
    const now = new Date();
    let number = quote.number;
    let year = quote.year;
    if (number == null) {
      year = brusselsYear(now);
      const seq = await nextInvoiceSequence(txClient, "quote", year);
      number = formatInvoiceNumber(settings.get("quoteNumberFormat") || DEFAULT_FORMAT, "quote", year, seq);
    }
    const days = quote.paymentTermDays ?? (Number(settings.get("quoteValidityDays")) || DEFAULT_VALIDITY_DAYS);

    return txClient.invoice.update({
      where: { id },
      data: {
        status: "verzonden", number, year, invoiceDate: now,
        validUntil: new Date(now.getTime() + days * 86_400_000),
        finalizedAt: quote.finalizedAt ?? now,
      },
      include: invoiceInclude,
    });
  });
}

async function moveStatus(id: number, from: string, to: string, message: string, client: PrismaClient) {
  return client.$transaction(async (tx) => {
    const txClient = tx as unknown as PrismaClient;
    await lockRow(txClient, "Invoice", id);
    const quote = await loadQuote(txClient, id);
    if (quote.status !== from) throw new QuoteError("WRONG_STATUS", message);
    return txClient.invoice.update({ where: { id }, data: { status: to }, include: invoiceInclude });
  });
}

/** verzonden → concept: a sent quote isn't a legal document, so it can be
 * edited again (and keeps its number). Once accepted or refused it is final. */
export const reopenQuote = (id: number, client: PrismaClient = defaultPrisma) =>
  moveStatus(id, "verzonden", "concept", "Alleen een verzonden offerte kan heropend worden", client);

/** verzonden → geweigerd. */
export const rejectQuote = (id: number, client: PrismaClient = defaultPrisma) =>
  moveStatus(id, "verzonden", "geweigerd", "Alleen een verzonden offerte kan geweigerd worden", client);
