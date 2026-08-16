import type { PrismaClient } from "@/generated/prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { toNumber } from "@/lib/serialize";
import { resolveInvoiceDisplayStatus } from "@/lib/invoice-status";
import type { ExportColumn } from "@/lib/export/xlsx-writer";

/**
 * P2.3 — export only, no import in any mode, ever (design doc §1.6,
 * stricter than the prompt's literal minimum which only forbids
 * *replace*): `Invoice.number` is gapless/sequential and every figure
 * is frozen once `status` leaves `concept` (J2b); an "upsert" import is
 * indistinguishable from editing a sent invoice's frozen amounts. This
 * route itself is gated entirely on `Kosten/Facturen: lezen` at the
 * route (not merely money-column omission) — virtually every column
 * here is money-shaped, so a partial export would still leak client
 * names, amounts due and payment status.
 */
export const INVOICES_EXPORT_COLUMNS: ExportColumn[] = [
  { key: "number", header: "number", type: "string" },
  { key: "kind", header: "kind", type: "string" },
  { key: "status", header: "status", type: "string" },
  { key: "clientName", header: "clientName", type: "string" },
  { key: "projectName", header: "projectName", type: "string" },
  { key: "invoiceDate", header: "invoiceDate", type: "date" },
  { key: "dueDate", header: "dueDate", type: "date" },
  { key: "subtotalExcl", header: "subtotalExcl", type: "number" },
  { key: "travelExcl", header: "travelExcl", type: "number" },
  { key: "deductionExcl", header: "deductionExcl", type: "number" },
  { key: "vatAmount", header: "vatAmount", type: "number" },
  { key: "totalIncl", header: "totalIncl", type: "number" },
];

export async function fetchInvoicesExportRows(
  client: PrismaClient = defaultPrisma,
): Promise<Record<string, unknown>[]> {
  const invoices = await client.invoice.findMany({
    include: { project: { select: { name: true } }, creditNotes: true },
    orderBy: { createdAt: "desc" },
  });

  return invoices.map((inv) => ({
    number: inv.number,
    kind: inv.kind,
    status: resolveInvoiceDisplayStatus({
      kind: inv.kind,
      status: inv.status,
      totalIncl: toNumber(inv.totalIncl),
      dueDate: inv.dueDate,
      creditNotes: inv.creditNotes.map((cn) => ({ status: cn.status, totalIncl: toNumber(cn.totalIncl) })),
    }),
    clientName: inv.clientName,
    projectName: inv.project?.name ?? null,
    invoiceDate: inv.invoiceDate,
    dueDate: inv.dueDate,
    subtotalExcl: toNumber(inv.subtotalExcl),
    travelExcl: toNumber(inv.travelExcl),
    deductionExcl: toNumber(inv.deductionExcl),
    vatAmount: toNumber(inv.vatAmount),
    totalIncl: toNumber(inv.totalIncl),
  }));
}
