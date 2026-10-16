import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

vi.stubEnv("DATABASE_URL", `file:/tmp/invoice-lines-crud-init.db`);
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
import { createCreditNote, CreditNoteError } from "@/lib/create-credit-note";
import { addManualLine, updateInvoiceLine } from "@/lib/invoice-lines-crud";
import { InvoiceLineEditError } from "@/lib/invoice-line-rules";
import { toNumber } from "@/lib/serialize";

const DB_PATH = path.join(os.tmpdir(), `invoice-lines-crud-${process.pid}.db`);
const DB_URL = `file:${DB_PATH}`;

let client: PrismaClient;
let projectId: number;

beforeAll(async () => {
  execSync(`DATABASE_URL=${DB_URL} npx prisma db push --schema=prisma/schema.dev.prisma`, { stdio: "pipe" });
  const adapter = new PrismaLibSql({ url: DB_URL });
  client = new PrismaClient({ adapter } as never);
  Object.assign(mockedPrisma as object, client);

  const clientRow = await client.client.create({ data: { name: "Lines Test Client" } });
  const person = await client.person.create({ data: { name: "Jan Peeters", dayPrice: 200 } });
  const project = await client.project.create({
    data: {
      name: "Lines Test Project", clientId: clientRow.id,
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

const draft = () => createDraftInvoice({ projectId, invoiceRole: "standalone" }, client);

describe("free invoice lines (C8)", () => {
  it("a manual line at 6% VAT lands in the subtotal with its own VAT", async () => {
    const inv = await draft();
    await addManualLine(inv.id, { description: "Vervoer", quantity: 2, unit: "stuk", unitPrice: 50, vatRate: 6 }, client);
    const after = await client.invoice.findUniqueOrThrow({ where: { id: inv.id } });
    expect(toNumber(after.subtotalExcl)).toBe(toNumber(inv.subtotalExcl) + 100);
    expect(toNumber(after.vatAmount)).toBeCloseTo(toNumber(inv.vatAmount) + 6, 2);
  });

  it("a negative price is a discount", async () => {
    const inv = await draft();
    await addManualLine(inv.id, { description: "Korting", quantity: 1, unit: "stuk", unitPrice: -40 }, client);
    const after = await client.invoice.findUniqueOrThrow({ where: { id: inv.id } });
    expect(toNumber(after.subtotalExcl)).toBe(toNumber(inv.subtotalExcl) - 40);
  });

  it("a text line changes no total and can be edited, but never gets an amount", async () => {
    const inv = await draft();
    const text = await addManualLine(inv.id, { kind: "text", description: "Betaling in 2 schijven" }, client);
    const after = await client.invoice.findUniqueOrThrow({ where: { id: inv.id } });
    expect(toNumber(after.totalIncl)).toBe(toNumber(inv.totalIncl));
    expect(text.kind).toBe("text");

    const edited = await updateInvoiceLine(inv.id, text.id, { description: "Betaling in 3 schijven" }, client);
    expect(edited.description).toBe("Betaling in 3 schijven");
    await expect(updateInvoiceLine(inv.id, text.id, { unitPrice: 10 }, client)).rejects.toBeInstanceOf(InvoiceLineEditError);
    const unchanged = await client.invoice.findUniqueOrThrow({ where: { id: inv.id } });
    expect(toNumber(unchanged.totalIncl)).toBe(toNumber(inv.totalIncl));
  });

  it("a generated line keeps the BTW setting — VAT can't be edited on it", async () => {
    const inv = await draft();
    const generated = inv.lines.find((l) => l.kind === "person")!;
    await expect(updateInvoiceLine(inv.id, generated.id, { vatRate: 6 }, client)).rejects.toBeInstanceOf(InvoiceLineEditError);
    await expect(updateInvoiceLine(inv.id, generated.id, { quantity: 2 }, client)).resolves.toBeTruthy();
  });

  it("a full credit note of an invoice with a text line still works and skips that line", async () => {
    const inv = await draft();
    await addManualLine(inv.id, { kind: "text", description: "Extra afspraak" }, client);
    const sent = await finalizeInvoice(inv.id, client);
    const cn = await createCreditNote(sent.id, undefined, client);
    expect(cn.lines.some((l) => l.kind === "text")).toBe(false);
    expect(toNumber(cn.totalIncl)).toBe(-toNumber(sent.totalIncl));
  });

  it("explicitly crediting a text line is refused", async () => {
    const inv = await draft();
    const text = await addManualLine(inv.id, { kind: "text", description: "Opmerking" }, client);
    const sent = await finalizeInvoice(inv.id, client);
    await expect(createCreditNote(sent.id, [{ lineId: text.id }], client)).rejects.toBeInstanceOf(CreditNoteError);
  });
});
