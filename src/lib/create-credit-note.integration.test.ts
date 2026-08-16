import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

vi.stubEnv("DATABASE_URL", `file:/tmp/create-credit-note-init.db`);
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
import { netInvoicedExcl } from "@/lib/invoice-status";
import { toNumber } from "@/lib/serialize";

const DB_PATH = path.join(os.tmpdir(), `create-credit-note-${process.pid}.db`);
const DB_URL = `file:${DB_PATH}`;

let client: PrismaClient;
let projectId: number;

beforeAll(async () => {
  execSync(`DATABASE_URL=${DB_URL} npx prisma db push --schema=prisma/schema.dev.prisma`, { stdio: "pipe" });
  const adapter = new PrismaLibSql({ url: DB_URL });
  client = new PrismaClient({ adapter } as never);
  Object.assign(mockedPrisma as object, client);

  const clientRow = await client.client.create({ data: { name: "Credit Note Test Client" } });
  const person = await client.person.create({ data: { name: "Jan Peeters", dayPrice: 200 } });
  const project = await client.project.create({
    data: {
      name: "Credit Note Test Project", clientId: clientRow.id,
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

describe("createCreditNote (J2b.5)", () => {
  it("rejects crediting a still-concept invoice", async () => {
    const draft = await createDraftInvoice({ projectId, invoiceRole: "standalone" }, client);
    await expect(createCreditNote(draft.id, undefined, client)).rejects.toMatchObject({ code: "NOT_SENT" });
  });

  it("rejects crediting a nonexistent invoice", async () => {
    await expect(createCreditNote(999999, undefined, client)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("rejects crediting a credit note itself", async () => {
    const invoice = await sentInvoice();
    const cn = await createCreditNote(invoice.id, undefined, client);
    await expect(createCreditNote(cn.id, undefined, client)).rejects.toMatchObject({
      code: "ALREADY_CREDIT_NOTE",
    });
  });

  it("a full mirror credit note negates every line and nets to zero with the original (design doc §4.3)", async () => {
    const invoice = await sentInvoice();
    const cn = await createCreditNote(invoice.id, undefined, client);

    expect(cn.kind).toBe("creditnota");
    expect(cn.series).toBe("credit");
    expect(cn.status).toBe("concept");
    expect(cn.creditNoteOfId).toBe(invoice.id);
    expect(cn.clientName).toBe(invoice.clientName); // snapshot copied, not a live join
    expect(Number(cn.subtotalExcl)).toBe(-Number(invoice.subtotalExcl));
    expect(Number(cn.totalIncl)).toBe(-Number(invoice.totalIncl));

    const net = netInvoicedExcl({
      subtotalExcl: toNumber(invoice.subtotalExcl),
      travelExcl: toNumber(invoice.travelExcl),
      deductionExcl: toNumber(invoice.deductionExcl),
      creditNotes: [{
        status: "verzonden", // simulate the CN having been finalised for this check
        subtotalExcl: toNumber(cn.subtotalExcl),
        travelExcl: toNumber(cn.travelExcl),
        deductionExcl: toNumber(cn.deductionExcl),
      }],
    });
    expect(net).toBe(0);
  });

  it("a partial credit note is capped at the original line's own quantity", async () => {
    const invoice = await sentInvoice();
    const line = invoice.lines[0];
    const tooMany = toNumber(line.quantity) + 1;
    await expect(
      createCreditNote(invoice.id, [{ lineId: line.id, quantity: tooMany }], client),
    ).rejects.toMatchObject({ code: "INVALID_QUANTITY" });

    const cn = await createCreditNote(invoice.id, [{ lineId: line.id, quantity: toNumber(line.quantity) }], client);
    expect(cn.lines).toHaveLength(1);
    expect(Number(cn.lines[0].quantity)).toBe(-toNumber(line.quantity));
    expect(Number(cn.lines[0].lineTotalExcl)).toBe(-toNumber(line.lineTotalExcl));
  });

  it("rejects a lineId that doesn't belong to the invoice", async () => {
    const invoice = await sentInvoice();
    await expect(
      createCreditNote(invoice.id, [{ lineId: 999999 }], client),
    ).rejects.toMatchObject({ code: "LINE_NOT_FOUND" });
  });
});
