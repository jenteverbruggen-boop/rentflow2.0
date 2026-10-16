import type { PrismaClient } from "@/generated/prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { assertDraftMutable } from "@/lib/invoices";
import { invoiceInclude } from "@/lib/serialize-invoice";

export class RefreshClientError extends Error {
  code: "NOT_FOUND" | "NOT_APPLICABLE" | "NO_CLIENT";
  constructor(code: RefreshClientError["code"], message: string) {
    super(message);
    this.code = code;
  }
}

/**
 * Re-copies the project's current client (name, address, VAT) onto a draft —
 * the snapshot is frozen at creation, so a corrected address or a changed
 * client otherwise only reached the invoice by deleting and recreating it.
 * Follows the project's client, so `clientId` moves with it. Draft only;
 * once sent, the snapshot is the legal record and never changes.
 */
export async function refreshInvoiceClient(invoiceId: number, client: PrismaClient = defaultPrisma) {
  const invoice = await client.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) throw new RefreshClientError("NOT_FOUND", "Factuur niet gevonden");
  assertDraftMutable(invoice);
  if (!invoice.projectId) throw new RefreshClientError("NOT_APPLICABLE", "Factuur heeft geen gekoppeld project");

  const project = await client.project.findUnique({
    where: { id: invoice.projectId },
    select: { clientRel: true },
  });
  const c = project?.clientRel;
  if (!c) throw new RefreshClientError("NO_CLIENT", "Project heeft geen klant gekoppeld");

  return client.invoice.update({
    where: { id: invoiceId },
    data: {
      clientId: c.id, clientName: c.name, clientAddress: c.address,
      clientPostalCode: c.postalCode, clientCity: c.city, clientVatNumber: c.vatNumber,
    },
    include: invoiceInclude,
  });
}
