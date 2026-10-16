import type { PrismaClient } from "@/generated/prisma/client";
import { buildInvoiceDraft } from "@/lib/build-invoice-draft";
import { invoiceDraftArgs } from "@/lib/invoice-draft-args";
import { hashDraftLines } from "@/lib/invoice-hash";

/**
 * Has the project changed since this draft's lines were generated? Re-runs
 * the generator and compares its fingerprint with the one stored when the
 * draft was (re)generated. Only a concept invoice can be stale. The check
 * is skipped when there is nothing to compare (no hash — drafts from before
 * this existed — or no project) and for a fixed-amount deposit, whose single
 * line doesn't depend on the project at all.
 */
export async function isInvoiceStale(
  invoice: {
    status: string;
    kind: string;
    sourceQuoteId: number | null;
    projectId: number | null;
    generatedHash: string | null;
    invoiceRole: string;
    depositType: string | null;
    depositPercentage: unknown;
    lines: { kind: string; unitPrice: unknown }[];
  },
  client: PrismaClient,
): Promise<boolean> {
  if (invoice.status !== "concept" || (invoice.kind !== "invoice" && invoice.kind !== "offerte")) return false;
  // Lines copied from a quote were never generated from the project.
  if (invoice.sourceQuoteId != null) return false;
  if (!invoice.projectId || !invoice.generatedHash) return false;
  if (invoice.depositType === "fixed") return false;

  const draft = await buildInvoiceDraft(invoiceDraftArgs({ ...invoice, projectId: invoice.projectId }), client);
  return draft ? hashDraftLines(draft.lines) !== invoice.generatedHash : false;
}
