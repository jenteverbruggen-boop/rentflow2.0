import { toNumber } from "@/lib/serialize";
import type { BuildInvoiceDraftArgs } from "@/lib/build-invoice-draft";
import type { DepositType, InvoiceRole } from "@/types";

/**
 * The inputs `buildInvoiceDraft` needs to regenerate an existing draft.
 * Only a deposit's percentage is persisted; a fixed-amount deposit has no
 * stored input, so its own deposit line's `unitPrice` stands in — the amount
 * was never a function of project data in the first place.
 */
export function invoiceDraftArgs(invoice: {
  projectId: number;
  invoiceRole: string;
  depositType: string | null;
  depositPercentage: unknown;
  lines: { kind: string; unitPrice: unknown }[];
}): BuildInvoiceDraftArgs {
  const depositValue =
    invoice.depositType === "percentage"
      ? toNumber(invoice.depositPercentage)
      : invoice.depositType === "fixed"
        ? toNumber(invoice.lines.find((l) => l.kind === "deposit")?.unitPrice)
        : undefined;
  return {
    projectId: invoice.projectId,
    invoiceRole: invoice.invoiceRole as InvoiceRole,
    depositType: (invoice.depositType as DepositType | null) ?? undefined,
    depositValue,
  };
}
