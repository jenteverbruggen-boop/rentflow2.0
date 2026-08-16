import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

vi.stubEnv("DATABASE_URL", `file:/tmp/finalize-invoice-init.db`);
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { execSync } from "child_process";
import os from "os";
import path from "path";
import fs from "fs";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "@/generated/prisma/client";
import { finalizeInvoice, FinalizeInvoiceError } from "@/lib/finalize-invoice";

const DB_PATH = path.join(os.tmpdir(), `finalize-invoice-${process.pid}.db`);
const DB_URL = `file:${DB_PATH}`;

let client: PrismaClient;
let clientId: number;

beforeAll(async () => {
  execSync(`DATABASE_URL=${DB_URL} npx prisma db push --schema=prisma/schema.dev.prisma`, { stdio: "pipe" });
  const adapter = new PrismaLibSql({ url: DB_URL });
  client = new PrismaClient({ adapter } as never);
  const c = await client.client.create({ data: { name: "Finalize Test Client" } });
  clientId = c.id;
}, 60_000);

afterAll(async () => {
  await client.$disconnect();
  fs.rmSync(DB_PATH, { force: true });
});

describe("finalizeInvoice (J2b.3/J2b.4)", () => {
  it("throws NOT_FOUND for a nonexistent invoice", async () => {
    await expect(finalizeInvoice(999999, client)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("allocates a number, sets status/dates, and uses the invoiceNumberFormat/term-days settings", async () => {
    await client.setting.createMany({
      data: [
        { key: "invoiceNumberFormat", value: "{year}-{seq:04d}" },
        { key: "invoicePaymentTermDays", value: "14" },
      ],
    });
    const draft = await client.invoice.create({
      data: { clientId, clientName: "Finalize Test Client", status: "concept" },
    });

    const finalized = await finalizeInvoice(draft.id, client);
    expect(finalized.status).toBe("verzonden");
    expect(finalized.number).toMatch(/^\d{4}-\d{4}$/);
    expect(finalized.invoiceDate).not.toBeNull();
    expect(finalized.finalizedAt).not.toBeNull();
    const dueDate = finalized.dueDate as Date;
    const invoiceDate = finalized.invoiceDate as Date;
    const days = Math.round((dueDate.getTime() - invoiceDate.getTime()) / 86_400_000);
    expect(days).toBe(14);
  });

  it("refuses to finalise an already-verzonden invoice (409-mapped ALREADY_FINALIZED)", async () => {
    const draft = await client.invoice.create({
      data: { clientId, clientName: "Finalize Test Client", status: "concept" },
    });
    await finalizeInvoice(draft.id, client);
    await expect(finalizeInvoice(draft.id, client)).rejects.toMatchObject({
      code: "ALREADY_FINALIZED",
    });
    await expect(finalizeInvoice(draft.id, client)).rejects.toBeInstanceOf(FinalizeInvoiceError);
  });

  it("two invoices finalised in the same year get consecutive numbers", async () => {
    const a = await client.invoice.create({ data: { clientId, clientName: "x", status: "concept" } });
    const b = await client.invoice.create({ data: { clientId, clientName: "x", status: "concept" } });
    const finalizedA = await finalizeInvoice(a.id, client);
    const finalizedB = await finalizeInvoice(b.id, client);
    const seqA = Number(finalizedA.number?.split("-").pop());
    const seqB = Number(finalizedB.number?.split("-").pop());
    expect(seqB).toBe(seqA + 1);
  });
});
