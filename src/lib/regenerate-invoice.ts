import type { PrismaClient } from "@/generated/prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { assertDraftMutable } from "@/lib/invoices";
import { buildInvoiceDraft } from "@/lib/build-invoice-draft";
import { invoiceInclude } from "@/lib/serialize-invoice";
import { toNumber } from "@/lib/serialize";
import type { InvoiceRole, DepositType } from "@/types";

export class InvoiceNotFoundError extends Error {}

/**
 * J2b.4 — re-runs §5's generator against the live project, discarding
 * every current line (manual lines included — the UI must warn before
 * calling this, per design doc §12 open risk 3). Fixed-amount deposits
 * have no separately stored input value (only `depositPercentage` is
 * persisted), so a fixed deposit's regenerate reuses its own existing
 * line's `unitPrice` rather than re-deriving from project data it was
 * never a function of in the first place.
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
    if (!invoice.projectId) {
      throw new Error("Factuur heeft geen gekoppeld project om opnieuw te genereren");
    }

    const depositValue =
      invoice.depositType === "percentage"
        ? toNumber(invoice.depositPercentage)
        : invoice.depositType === "fixed"
          ? toNumber(invoice.lines.find((l) => l.kind === "deposit")?.unitPrice)
          : undefined;

    const draft = await buildInvoiceDraft(
      {
        projectId: invoice.projectId,
        invoiceRole: invoice.invoiceRole as InvoiceRole,
        depositType: (invoice.depositType as DepositType | null) ?? undefined,
        depositValue,
      },
      txClient,
    );
    if (!draft) throw new InvoiceNotFoundError();

    await txClient.invoiceLine.deleteMany({ where: { invoiceId } });
    await txClient.invoiceLine.createMany({
      data: draft.lines.map((l) => ({ ...l, invoiceId })),
    });
    await txClient.invoice.update({ where: { id: invoiceId }, data: draft.totals });
    return txClient.invoice.findUniqueOrThrow({ where: { id: invoiceId }, include: invoiceInclude });
  });
}
