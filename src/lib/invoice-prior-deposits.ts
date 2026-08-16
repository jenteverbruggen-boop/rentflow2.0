import { format } from "date-fns";
import type { PrismaClient } from "@/generated/prisma/client";
import { netInvoicedExcl } from "@/lib/invoice-status";
import { toNumber } from "@/lib/serialize";
import type { PriorDeposit } from "@/lib/invoice-lines";

/**
 * J2b.2 — every prior, non-concept deposit invoice for a project,
 * reduced to what generateDraftInvoiceLines's `priorDeposits` needs.
 * `vatRate` is copied from that deposit's own single line (design doc
 * §4.2's double-VAT-charge reasoning) — never today's setting.
 * Extracted from the route to keep it under the 150-line limit.
 */
export async function loadPriorDeposits(
  prisma: PrismaClient,
  projectId: number,
  fallbackVatRate: number,
): Promise<PriorDeposit[]> {
  const deposits = await prisma.invoice.findMany({
    where: { projectId, invoiceRole: "deposit", status: { not: "concept" } },
    include: { lines: true, creditNotes: true },
  });
  return deposits.map((inv) => ({
    number: inv.number ?? "",
    invoiceDate: inv.invoiceDate ? format(inv.invoiceDate, "dd/MM/yyyy") : "",
    netExcl: netInvoicedExcl({
      subtotalExcl: toNumber(inv.subtotalExcl),
      travelExcl: toNumber(inv.travelExcl),
      deductionExcl: toNumber(inv.deductionExcl),
      creditNotes: inv.creditNotes.map((cn) => ({
        status: cn.status,
        subtotalExcl: toNumber(cn.subtotalExcl),
        travelExcl: toNumber(cn.travelExcl),
        deductionExcl: toNumber(cn.deductionExcl),
      })),
    }),
    vatRate: toNumber(inv.lines.find((l) => l.kind === "deposit")?.vatRate ?? fallbackVatRate),
  }));
}
