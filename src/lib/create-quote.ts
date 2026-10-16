import type { PrismaClient } from "@/generated/prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { buildInvoiceDraft } from "@/lib/build-invoice-draft";
import { hashDraftLines } from "@/lib/invoice-hash";
import { invoiceInclude } from "@/lib/serialize-invoice";
import { QuoteError } from "@/lib/quote-error";

/**
 * A new draft quote for a project: the same lines the project would be
 * invoiced with (people, materials, sets, travel — and, unlike an invoice,
 * overbooked units, since a quote is exactly how an overbooked concept project
 * gets priced). Stored as an Invoice with kind "offerte"; it takes its number
 * (own series) only when it is sent.
 */
export async function createQuote(projectId: number, client: PrismaClient = defaultPrisma) {
  const draft = await buildInvoiceDraft({ projectId, invoiceRole: "standalone" }, client);
  if (!draft) throw new QuoteError("NOT_FOUND", "Project niet gevonden");
  const clientRel = draft.project.clientRel;
  if (!clientRel) throw new QuoteError("NO_CLIENT", "Project heeft geen klant gekoppeld — koppel eerst een klant");

  return client.invoice.create({
    data: {
      kind: "offerte",
      series: "quote",
      invoiceRole: "standalone",
      projectId: draft.project.id,
      clientId: clientRel.id,
      clientName: clientRel.name,
      clientAddress: clientRel.address,
      clientPostalCode: clientRel.postalCode,
      clientCity: clientRel.city,
      clientVatNumber: clientRel.vatNumber,
      generatedHash: hashDraftLines(draft.lines),
      ...draft.totals,
      lines: { create: draft.lines },
    },
    include: invoiceInclude,
  });
}
