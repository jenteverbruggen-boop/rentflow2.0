import type { PrismaClient } from "@/generated/prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { nextInvoiceSequence, formatInvoiceNumber, brusselsYear } from "@/lib/invoice-numbering";
import { invoiceInclude } from "@/lib/serialize-invoice";

export class FinalizeInvoiceError extends Error {
  code: "NOT_FOUND" | "ALREADY_FINALIZED";
  constructor(code: "NOT_FOUND" | "ALREADY_FINALIZED", message: string) {
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
export async function finalizeInvoice(id: number, client: PrismaClient = defaultPrisma) {
  return client.$transaction(async (tx) => {
    const txClient = tx as unknown as PrismaClient;
    const invoice = await txClient.invoice.findUnique({ where: { id } });
    if (!invoice) throw new FinalizeInvoiceError("NOT_FOUND", "Factuur niet gevonden");
    if (invoice.status !== "concept") {
      throw new FinalizeInvoiceError(
        "ALREADY_FINALIZED",
        "Factuur is al verzonden — niet meer te wijzigen",
      );
    }

    const settingRows = await txClient.setting.findMany({
      where: { key: { in: ["invoiceNumberFormat", "invoicePaymentTermDays"] } },
    });
    const settings = new Map(settingRows.map((r) => [r.key, r.value ?? ""]));
    const format = settings.get("invoiceNumberFormat") || DEFAULT_FORMAT;
    const termDays = Number(settings.get("invoicePaymentTermDays")) || DEFAULT_TERM_DAYS;

    const series = invoice.kind === "creditnota" ? "credit" : "invoice";
    const now = new Date();
    const year = brusselsYear(now);
    const seq = await nextInvoiceSequence(txClient, series, year);
    const number = formatInvoiceNumber(format, series, year, seq);
    const dueDate = new Date(now.getTime() + termDays * 86_400_000);

    return txClient.invoice.update({
      where: { id },
      data: { number, year, series, status: "verzonden", invoiceDate: now, dueDate, finalizedAt: now },
      include: invoiceInclude,
    });
  });
}
