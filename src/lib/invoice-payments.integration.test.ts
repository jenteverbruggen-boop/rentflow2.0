import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

vi.stubEnv("DATABASE_URL", `file:/tmp/invoice-payments-init.db`);
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { execSync } from "child_process";
import os from "os";
import path from "path";
import fs from "fs";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "@/generated/prisma/client";
import { prisma as mockedPrisma } from "@/lib/prisma";
import { createDraftInvoice } from "@/lib/create-draft-invoice";
import { finalizeInvoice } from "@/lib/finalize-invoice";
import { createCreditNote } from "@/lib/create-credit-note";
import {
  recordPayment,
  updatePayment,
  deletePayment,
  PaymentRejectedError,
  PaymentNotFoundError,
} from "@/lib/invoice-payments";

const DB_PATH = path.join(os.tmpdir(), `invoice-payments-${process.pid}.db`);
const DB_URL = `file:${DB_PATH}`;

let client: PrismaClient;
let projectId: number;

beforeAll(async () => {
  execSync(`DATABASE_URL=${DB_URL} npx prisma db push --schema=prisma/schema.dev.prisma`, { stdio: "pipe" });
  const adapter = new PrismaLibSql({ url: DB_URL });
  client = new PrismaClient({ adapter } as never);
  Object.assign(mockedPrisma as object, client);

  const clientRow = await client.client.create({ data: { name: "Payments Test Client" } });
  const person = await client.person.create({ data: { name: "Jan Peeters", dayPrice: 200 } });
  const project = await client.project.create({
    data: {
      name: "Payments Test Project", clientId: clientRow.id,
      startDate: new Date("2026-06-01"), endDate: new Date("2026-06-01"),
      periods: {
        create: [{
          name: "Opbouw", startDate: new Date("2026-06-01"), endDate: new Date("2026-06-01"),
          people: { create: [{ personId: person.id, dayPriceSnapshot: 200 }] },
        }],
      },
    },
  });
  projectId = project.id;
}, 60_000);

afterAll(async () => {
  await client.$disconnect();
  fs.rmSync(DB_PATH, { force: true });
});

async function sentInvoice() {
  const draft = await createDraftInvoice({ projectId, invoiceRole: "standalone" }, client);
  return finalizeInvoice(draft.id, client);
}

describe("invoice-payments (J2b.6)", () => {
  it("rejects a payment on a still-concept invoice", async () => {
    const draft = await createDraftInvoice({ projectId, invoiceRole: "standalone" }, client);
    await expect(
      recordPayment(draft.id, { amount: 100, paidAt: "2026-06-01" }, client),
    ).rejects.toMatchObject({ code: "CONCEPT" });
  });

  it("rejects a payment on a credit note", async () => {
    const invoice = await sentInvoice();
    const cn = await createCreditNote(invoice.id, undefined, client);
    await expect(
      recordPayment(cn.id, { amount: 10, paidAt: "2026-06-01" }, client),
    ).rejects.toBeInstanceOf(PaymentRejectedError);
  });

  it("a full payment flips the invoice to betaald automatically", async () => {
    const invoice = await sentInvoice();
    await recordPayment(invoice.id, { amount: Number(invoice.totalIncl), paidAt: "2026-06-01" }, client);
    const updated = await client.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
    expect(updated.status).toBe("betaald");
  });

  it("a partial payment leaves status verzonden (display-status derivation shows gedeeltelijk_betaald separately)", async () => {
    const invoice = await sentInvoice();
    await recordPayment(invoice.id, { amount: Number(invoice.totalIncl) / 2, paidAt: "2026-06-01" }, client);
    const updated = await client.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
    expect(updated.status).toBe("verzonden");
  });

  it("deleting a payment that completed the balance flips status back to verzonden", async () => {
    const invoice = await sentInvoice();
    const payment = await recordPayment(invoice.id, { amount: Number(invoice.totalIncl), paidAt: "2026-06-01" }, client);
    expect((await client.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).status).toBe("betaald");

    await deletePayment(invoice.id, payment.id, client);
    expect((await client.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).status).toBe("verzonden");
  });

  it("correcting a payment's amount downward re-opens a betaald invoice", async () => {
    const invoice = await sentInvoice();
    const payment = await recordPayment(invoice.id, { amount: Number(invoice.totalIncl), paidAt: "2026-06-01" }, client);
    await updatePayment(invoice.id, payment.id, { amount: Number(invoice.totalIncl) - 10 }, client);
    expect((await client.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).status).toBe("verzonden");
  });

  it("throws PaymentNotFoundError for a payment id not on this invoice", async () => {
    const invoice = await sentInvoice();
    await expect(updatePayment(invoice.id, 999999, { amount: 1 }, client)).rejects.toBeInstanceOf(
      PaymentNotFoundError,
    );
    await expect(deletePayment(invoice.id, 999999, client)).rejects.toBeInstanceOf(PaymentNotFoundError);
  });
});
