import type { PrismaClient } from "@/generated/prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { buildInvoiceDraft, type BuildInvoiceDraftArgs } from "@/lib/build-invoice-draft";
import { invoiceInclude } from "@/lib/serialize-invoice";

export type CreateDraftInvoiceArgs = BuildInvoiceDraftArgs;

export class CreateDraftInvoiceError extends Error {
  code: "NOT_FOUND" | "NO_CLIENT";
  constructor(code: "NOT_FOUND" | "NO_CLIENT", message: string) {
    super(message);
    this.code = code;
  }
}

/**
 * J2b.2 — the lib half of "create and store draft invoices" (design
 * doc §7's `POST /api/invoices`), split from the route so it can be
 * tested against a real DB the way M1.4's apply-material-import.ts is
 * (this codebase has no route-handler test convention — auth/cookies
 * make that awkward — so business logic lives in a lib function the
 * route thinly wraps).
 */
export async function createDraftInvoice(
  args: CreateDraftInvoiceArgs,
  client: PrismaClient = defaultPrisma,
) {
  const draft = await buildInvoiceDraft(args, client);
  if (!draft) throw new CreateDraftInvoiceError("NOT_FOUND", "Project niet gevonden");
  const clientRel = draft.project.clientRel;
  if (!clientRel) {
    throw new CreateDraftInvoiceError("NO_CLIENT", "Project heeft geen klant gekoppeld");
  }
  const { project, lines, totals, depositBasisExcl } = draft;

  return client.invoice.create({
    data: {
      invoiceRole: args.invoiceRole,
      projectId: project.id,
      clientId: clientRel.id,
      clientName: clientRel.name,
      clientAddress: clientRel.address,
      clientPostalCode: clientRel.postalCode,
      clientCity: clientRel.city,
      clientVatNumber: clientRel.vatNumber,
      depositType: args.invoiceRole === "deposit" ? (args.depositType ?? null) : null,
      depositPercentage:
        args.invoiceRole === "deposit" && args.depositType === "percentage"
          ? args.depositValue
          : null,
      depositBasisExcl,
      ...totals,
      lines: { create: lines },
    },
    include: invoiceInclude,
  });
}
