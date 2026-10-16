import type { PrismaClient } from "@/generated/prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { computeInvoiceTotals } from "@/lib/invoice-totals";
import { deductionLines, type DraftInvoiceLine } from "@/lib/invoice-lines";
import { loadPriorDeposits } from "@/lib/invoice-prior-deposits";
import { netInvoicedExcl } from "@/lib/invoice-status";
import { invoiceInclude } from "@/lib/serialize-invoice";
import { toNumber } from "@/lib/serialize";
import { QuoteError } from "@/lib/quote-error";
import type { DepositType, InvoiceLineKind, InvoiceLineUnit } from "@/types";

export type ConvertMode = "full" | "deposit" | "final";
export interface ConvertArgs {
  mode: ConvertMode;
  depositType?: DepositType;
  depositValue?: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * An accepted quote becomes an invoice draft. The lines are the quote's own,
 * copied verbatim — free lines, text and per-line VAT included — not
 * recomputed from the project: what was quoted is what gets invoiced. Only the
 * client snapshot is re-read, so the invoice carries today's address.
 *
 * - `full`: every quote line, one invoice.
 * - `deposit`: one line for a % / fixed amount of the quote's total.
 * - `final`: every quote line, minus the deposits already invoiced.
 *
 * A quote is invoiced once: `full` and `final` refuse while another conversion
 * is still live (a draft, or sent and not credited back), `final` needs a sent
 * deposit, and a deposit can't be added once the rest was invoiced.
 */
export async function convertQuote(id: number, args: ConvertArgs, client: PrismaClient = defaultPrisma) {
  return client.$transaction(async (tx) => {
    const txClient = tx as unknown as PrismaClient;
    const quote = await txClient.invoice.findUnique({ where: { id }, include: { lines: true } });
    if (!quote) throw new QuoteError("NOT_FOUND", "Offerte niet gevonden");
    if (quote.kind !== "offerte") throw new QuoteError("NOT_A_QUOTE", "Dit is geen offerte");
    if (quote.status !== "aanvaard") throw new QuoteError("NOT_ACCEPTED", "Alleen een aanvaarde offerte kan omgezet worden");
    if (quote.projectId == null) throw new QuoteError("NOT_FOUND", "Offerte heeft geen project");

    const live = (await txClient.invoice.findMany({
      where: { sourceQuoteId: id, kind: "invoice" },
      include: { creditNotes: true },
    })).filter(
      (inv) =>
        inv.status === "concept" ||
        netInvoicedExcl({
          subtotalExcl: toNumber(inv.subtotalExcl), travelExcl: toNumber(inv.travelExcl),
          deductionExcl: toNumber(inv.deductionExcl),
          creditNotes: inv.creditNotes.map((cn) => ({
            status: cn.status, subtotalExcl: toNumber(cn.subtotalExcl),
            travelExcl: toNumber(cn.travelExcl), deductionExcl: toNumber(cn.deductionExcl),
          })),
        }) !== 0,
    );
    const liveDeposits = live.filter((i) => i.invoiceRole === "deposit");
    if (live.length > liveDeposits.length || (args.mode === "full" && live.length > 0)) {
      throw new QuoteError("ALREADY_CONVERTED", "Deze offerte is al omgezet naar een factuur");
    }
    if (args.mode === "final" && !liveDeposits.some((d) => d.status !== "concept")) {
      throw new QuoteError("NO_DEPOSIT", "Een eindfactuur kan pas na een verzonden voorschotfactuur");
    }

    const project = await txClient.project.findUnique({ where: { id: quote.projectId }, select: { clientRel: true } });
    const c = project?.clientRel;
    const btw = await txClient.setting.findUnique({ where: { key: "btwRate" } });
    const vatRate = Number(btw?.value || "21");
    const basis = round2(toNumber(quote.subtotalExcl) + toNumber(quote.travelExcl));

    const copied: DraftInvoiceLine[] = quote.lines
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((l, i) => ({
        section: l.section, kind: l.kind as InvoiceLineKind, description: l.description, quantity: toNumber(l.quantity),
        unit: l.unit as InvoiceLineUnit, unitPrice: toNumber(l.unitPrice), vatRate: toNumber(l.vatRate),
        lineTotalExcl: toNumber(l.lineTotalExcl), sortOrder: i, sourceKind: l.sourceKind, sourceId: l.sourceId,
      }));

    let lines: DraftInvoiceLine[];
    if (args.mode === "deposit") {
      const isFixed = args.depositType === "fixed";
      const amount = round2(isFixed ? args.depositValue ?? 0 : (basis * (args.depositValue ?? 0)) / 100);
      lines = [{
        section: null, kind: "deposit",
        description: isFixed ? `Voorschot op offerte ${quote.number}` : `Voorschot ${args.depositValue}% op offerte ${quote.number}`,
        quantity: 1, unit: "stuk", unitPrice: amount, vatRate, lineTotalExcl: amount, sortOrder: 0,
        sourceKind: "quote", sourceId: quote.id,
      }];
    } else if (args.mode === "final") {
      lines = [...copied, ...deductionLines(await loadPriorDeposits(txClient, quote.projectId, vatRate), copied.length)];
    } else {
      lines = copied;
    }

    return txClient.invoice.create({
      data: {
        kind: "invoice",
        series: "invoice",
        invoiceRole: args.mode === "deposit" ? "deposit" : args.mode === "final" ? "final" : "standalone",
        sourceQuoteId: quote.id,
        projectId: quote.projectId,
        clientId: c?.id ?? quote.clientId,
        clientName: c?.name ?? quote.clientName,
        clientAddress: c ? c.address : quote.clientAddress,
        clientPostalCode: c ? c.postalCode : quote.clientPostalCode,
        clientCity: c ? c.city : quote.clientCity,
        clientVatNumber: c ? c.vatNumber : quote.clientVatNumber,
        depositType: args.mode === "deposit" ? args.depositType ?? null : null,
        depositPercentage: args.mode === "deposit" && args.depositType === "percentage" ? args.depositValue : null,
        depositBasisExcl: args.mode === "deposit" ? basis : null,
        notes: quote.notes,
        ...computeInvoiceTotals(lines),
        lines: { create: lines },
      },
      include: invoiceInclude,
    });
  });
}
