import type { PrismaClient } from "@/generated/prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { remainingBalance } from "@/lib/invoice-status";
import { toNumber } from "@/lib/serialize";

export class InvoiceNotFoundError extends Error {}
export class PaymentNotFoundError extends Error {}
export class PaymentRejectedError extends Error {
  code: "CONCEPT" | "CREDIT_NOTE";
  constructor(code: "CONCEPT" | "CREDIT_NOTE", message: string) {
    super(message);
    this.code = code;
  }
}

export interface PaymentInput {
  amount: number;
  paidAt: string;
  method?: string | null;
  reference?: string | null;
  notes?: string | null;
}

/** After any payment write, flip status to match the new balance —
 * §6.2: `betaald` the moment `remainingBalance <= 0`, back to
 * `verzonden` the moment it's positive again (a corrected mis-entered
 * payment must not leave a "betaald" invoice with money still owed). */
async function syncStatus(tx: PrismaClient, invoiceId: number): Promise<void> {
  const invoice = await tx.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    include: { payments: true, creditNotes: true },
  });
  const balance = remainingBalance({
    totalIncl: toNumber(invoice.totalIncl),
    dueDate: invoice.dueDate,
    kind: invoice.kind,
    status: invoice.status,
    creditNotes: invoice.creditNotes.map((cn) => ({ status: cn.status, totalIncl: toNumber(cn.totalIncl) })),
    payments: invoice.payments.map((p) => ({ amount: toNumber(p.amount) })),
  });
  const nextStatus = balance <= 0 ? "betaald" : "verzonden";
  if (invoice.status !== nextStatus && (invoice.status === "betaald" || invoice.status === "verzonden")) {
    await tx.invoice.update({ where: { id: invoiceId }, data: { status: nextStatus } });
  }
}

async function assertPayable(tx: PrismaClient, invoiceId: number) {
  const invoice = await tx.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) throw new InvoiceNotFoundError();
  if (invoice.status === "concept") {
    throw new PaymentRejectedError("CONCEPT", "Factuur is nog concept — nog geen betalingen mogelijk");
  }
  if (invoice.kind === "creditnota") {
    throw new PaymentRejectedError("CREDIT_NOTE", "Een creditnota ontvangt geen betalingen");
  }
  return invoice;
}

export async function recordPayment(
  invoiceId: number,
  input: PaymentInput,
  client: PrismaClient = defaultPrisma,
) {
  return client.$transaction(async (tx) => {
    const txClient = tx as unknown as PrismaClient;
    await assertPayable(txClient, invoiceId);

    const payment = await txClient.payment.create({
      data: {
        invoiceId,
        amount: input.amount,
        paidAt: new Date(input.paidAt),
        method: input.method ?? null,
        reference: input.reference ?? null,
        notes: input.notes ?? null,
      },
    });
    await syncStatus(txClient, invoiceId);
    return payment;
  });
}

export async function updatePayment(
  invoiceId: number,
  paymentId: number,
  patch: Partial<PaymentInput>,
  client: PrismaClient = defaultPrisma,
) {
  return client.$transaction(async (tx) => {
    const txClient = tx as unknown as PrismaClient;
    const existing = await txClient.payment.findFirst({ where: { id: paymentId, invoiceId } });
    if (!existing) throw new PaymentNotFoundError();

    const payment = await txClient.payment.update({
      where: { id: paymentId },
      data: {
        amount: patch.amount,
        paidAt: patch.paidAt ? new Date(patch.paidAt) : undefined,
        method: patch.method,
        reference: patch.reference,
        notes: patch.notes,
      },
    });
    await syncStatus(txClient, invoiceId);
    return payment;
  });
}

export async function deletePayment(
  invoiceId: number,
  paymentId: number,
  client: PrismaClient = defaultPrisma,
): Promise<void> {
  await client.$transaction(async (tx) => {
    const txClient = tx as unknown as PrismaClient;
    const existing = await txClient.payment.findFirst({ where: { id: paymentId, invoiceId } });
    if (!existing) throw new PaymentNotFoundError();

    await txClient.payment.delete({ where: { id: paymentId } });
    await syncStatus(txClient, invoiceId);
  });
}
