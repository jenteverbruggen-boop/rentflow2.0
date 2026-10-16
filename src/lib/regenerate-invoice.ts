import type { PrismaClient } from "@/generated/prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { assertDraftMutable } from "@/lib/invoices";
import { assertInvoiceable } from "@/lib/invoice-guards";
import { buildInvoiceDraft } from "@/lib/build-invoice-draft";
import { invoiceDraftArgs } from "@/lib/invoice-draft-args";
import { hashDraftLines } from "@/lib/invoice-hash";
import { computeInvoiceTotals } from "@/lib/invoice-totals";
import { invoiceInclude } from "@/lib/serialize-invoice";
import { toNumber } from "@/lib/serialize";
import type { InvoiceLineKind } from "@/types";

export class InvoiceNotFoundError extends Error {}

/** Only generated documents can be regenerated from the project: a
 * credit note's lines are negated copies of another invoice, and
 * regenerating them would turn them into positive project lines. */
export class RegenerateNotAllowedError extends Error {
  constructor(message = "Een creditnota kan niet opnieuw gegenereerd worden") {
    super(message);
  }
}

/** The PO's own lines: free items/costs and text paragraphs. Everything else
 * is generator output and is recomputed. */
const OWN_KINDS = ["manual", "text"];

/**
 * J2b.4 — re-runs §5's generator against the live project and replaces the
 * *generated* lines with the fresh result (inline edits of generated lines
 * go with them — the UI says so before calling this). The PO's own lines
 * (free items, discounts, text) are kept, in their order and sections, after
 * the generated ones, and the totals cover both. The generator hash is
 * refreshed so the "project changed" warning clears.
 */
export async function regenerateInvoice(invoiceId: number, client: PrismaClient = defaultPrisma) {
  return client.$transaction(async (tx) => {
    const txClient = tx as unknown as PrismaClient;
    const invoice = await txClient.invoice.findUnique({
      where: { id: invoiceId },
      include: { lines: true },
    });
    if (!invoice) throw new InvoiceNotFoundError();
    assertDraftMutable(invoice);
    if (invoice.kind === "creditnota") throw new RegenerateNotAllowedError();
    if (invoice.sourceQuoteId != null) {
      throw new RegenerateNotAllowedError("Deze factuur komt uit een offerte — pas de offerte aan of wijzig de regels hier");
    }
    if (!invoice.projectId) {
      throw new Error("Factuur heeft geen gekoppeld project om opnieuw te genereren");
    }

    // Quotes are exempt: they exist to price an overbooked concept project.
    if (invoice.kind === "invoice") await assertInvoiceable(invoice.projectId, txClient);
    const draft = await buildInvoiceDraft(invoiceDraftArgs({ ...invoice, projectId: invoice.projectId }), txClient);
    if (!draft) throw new InvoiceNotFoundError();

    const own = invoice.lines.filter((l) => OWN_KINDS.includes(l.kind)).sort((a, b) => a.sortOrder - b.sortOrder);
    const ownLines = own.map((l, i) => ({
      invoiceId,
      section: l.section,
      kind: l.kind,
      description: l.description,
      quantity: l.quantity,
      unit: l.unit,
      unitPrice: l.unitPrice,
      vatRate: l.vatRate,
      lineTotalExcl: l.lineTotalExcl,
      sortOrder: draft.lines.length + i,
      sourceKind: l.sourceKind,
      sourceId: l.sourceId,
    }));
    const totals = computeInvoiceTotals([
      ...draft.lines,
      ...own.map((l) => ({
        kind: l.kind as InvoiceLineKind,
        lineTotalExcl: toNumber(l.lineTotalExcl),
        vatRate: toNumber(l.vatRate),
      })),
    ]);

    await txClient.invoiceLine.deleteMany({ where: { invoiceId } });
    await txClient.invoiceLine.createMany({
      data: [...draft.lines.map((l) => ({ ...l, invoiceId })), ...ownLines],
    });
    await txClient.invoice.update({
      where: { id: invoiceId },
      data: { ...totals, generatedHash: hashDraftLines(draft.lines) },
    });
    return txClient.invoice.findUniqueOrThrow({ where: { id: invoiceId }, include: invoiceInclude });
  });
}
