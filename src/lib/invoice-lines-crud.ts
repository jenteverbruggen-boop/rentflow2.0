import type { PrismaClient } from "@/generated/prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { assertDraftMutable } from "@/lib/invoices";
import { computeInvoiceTotals } from "@/lib/invoice-totals";
import { toNumber } from "@/lib/serialize";
import type { InvoiceLineKind, InvoiceLineUnit } from "@/types";

export class InvoiceNotFoundError extends Error {}
export class InvoiceLineNotFoundError extends Error {}

export interface ManualLineInput {
  description: string;
  quantity: number;
  unit: InvoiceLineUnit;
  unitPrice: number;
  vatRate?: number;
  section?: string | null;
}

/** J2b.4 — every line CUD op recomputes and persists the five
 * invoice-level totals in the same transaction; the caller never sees
 * a moment where lines and totals disagree. */
async function recomputeTotals(tx: PrismaClient, invoiceId: number): Promise<void> {
  const lines = await tx.invoiceLine.findMany({ where: { invoiceId } });
  const totals = computeInvoiceTotals(
    lines.map((l) => ({
      kind: l.kind as InvoiceLineKind,
      lineTotalExcl: toNumber(l.lineTotalExcl),
      vatRate: toNumber(l.vatRate),
    })),
  );
  await tx.invoice.update({ where: { id: invoiceId }, data: totals });
}

async function loadMutableInvoice(tx: PrismaClient, invoiceId: number) {
  const invoice = await tx.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) throw new InvoiceNotFoundError();
  assertDraftMutable(invoice);
  return invoice;
}

export async function addManualLine(
  invoiceId: number,
  input: ManualLineInput,
  client: PrismaClient = defaultPrisma,
) {
  return client.$transaction(async (tx) => {
    const txClient = tx as unknown as PrismaClient;
    await loadMutableInvoice(txClient, invoiceId);

    let vatRate = input.vatRate;
    if (vatRate == null) {
      // Read the setting through the same tx connection — getSettings()
      // uses the default (outer) Prisma client, and calling it from
      // inside this transaction would deadlock SQLite's single
      // connection in dev/tests (a real, once-hit bug, not a
      // hypothetical).
      const row = await txClient.setting.findUnique({ where: { key: "btwRate" } });
      vatRate = Number(row?.value || "21");
    }
    const maxSort = await txClient.invoiceLine.aggregate({
      where: { invoiceId },
      _max: { sortOrder: true },
    });
    const line = await txClient.invoiceLine.create({
      data: {
        invoiceId,
        kind: "manual",
        description: input.description,
        quantity: input.quantity,
        unit: input.unit,
        unitPrice: input.unitPrice,
        vatRate,
        lineTotalExcl: input.quantity * input.unitPrice,
        sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
        section: input.section ?? null,
      },
    });
    await recomputeTotals(txClient, invoiceId);
    return line;
  });
}

export async function updateInvoiceLine(
  invoiceId: number,
  lineId: number,
  patch: Partial<ManualLineInput>,
  client: PrismaClient = defaultPrisma,
) {
  return client.$transaction(async (tx) => {
    const txClient = tx as unknown as PrismaClient;
    await loadMutableInvoice(txClient, invoiceId);
    const line = await txClient.invoiceLine.findFirst({ where: { id: lineId, invoiceId } });
    if (!line) throw new InvoiceLineNotFoundError();

    const quantity = patch.quantity ?? toNumber(line.quantity);
    const unitPrice = patch.unitPrice ?? toNumber(line.unitPrice);
    const updated = await txClient.invoiceLine.update({
      where: { id: lineId },
      data: {
        description: patch.description,
        quantity,
        unit: patch.unit,
        unitPrice,
        vatRate: patch.vatRate,
        lineTotalExcl: quantity * unitPrice,
        section: patch.section,
      },
    });
    await recomputeTotals(txClient, invoiceId);
    return updated;
  });
}

export async function deleteInvoiceLine(
  invoiceId: number,
  lineId: number,
  client: PrismaClient = defaultPrisma,
): Promise<void> {
  await client.$transaction(async (tx) => {
    const txClient = tx as unknown as PrismaClient;
    await loadMutableInvoice(txClient, invoiceId);
    const line = await txClient.invoiceLine.findFirst({ where: { id: lineId, invoiceId } });
    if (!line) throw new InvoiceLineNotFoundError();

    await txClient.invoiceLine.delete({ where: { id: lineId } });
    await recomputeTotals(txClient, invoiceId);
  });
}
