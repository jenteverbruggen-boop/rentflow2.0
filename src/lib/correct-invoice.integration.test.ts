import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

vi.stubEnv("DATABASE_URL", `file:/tmp/correct-invoice-init.db`);
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { execSync } from "child_process";
import os from "os";
import path from "path";
import fs from "fs";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "@/generated/prisma/client";
import { prisma as mockedPrisma } from "@/lib/prisma";
import { createDraftInvoice } from "@/lib/create-draft-invoice";
import { finalizeInvoice, FinalizeInvoiceError } from "@/lib/finalize-invoice";
import { createCreditNote, CreditNoteError } from "@/lib/create-credit-note";
import { correctInvoice, CorrectInvoiceError } from "@/lib/correct-invoice";
import { addManualLine } from "@/lib/invoice-lines-crud";
import { recordPayment } from "@/lib/invoice-payments";
import { toNumber } from "@/lib/serialize";

const DB_PATH = path.join(os.tmpdir(), `correct-invoice-${process.pid}.db`);
const DB_URL = `file:${DB_PATH}`;

let client: PrismaClient;
let projectId: number;

beforeAll(async () => {
  execSync(`DATABASE_URL=${DB_URL} npx prisma db push --schema=prisma/schema.dev.prisma`, { stdio: "pipe" });
  client = new PrismaClient({ adapter: new PrismaLibSql({ url: DB_URL }) } as never);
  Object.assign(mockedPrisma as object, client);

  const clientRow = await client.client.create({ data: { name: "Correct Test Client" } });
  const person = await client.person.create({ data: { name: "Jan Peeters", dayPrice: 200 } });
  const project = await client.project.create({
    data: {
      name: "Correct Test Project", clientId: clientRow.id,
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

async function sent(role: "standalone" | "deposit" | "final" = "standalone", extra?: Parameters<typeof createDraftInvoice>[0]) {
  const draft = await createDraftInvoice(extra ?? { projectId, invoiceRole: role }, client);
  await addManualLine(draft.id, { kind: "text", description: "Afspraak X" }, client);
  await addManualLine(draft.id, { description: "Vervoer", quantity: 1, unit: "stuk", unitPrice: 50, vatRate: 6 }, client);
  return finalizeInvoice(draft.id, client);
}

describe("correctInvoice (C1b)", () => {
  it("creates a full credit note draft and a replacement draft with the same lines", async () => {
    const original = await sent();
    const { creditNote, replacement } = await correctInvoice(original.id, client);

    expect(creditNote.kind).toBe("creditnota");
    expect(creditNote.status).toBe("concept");
    expect(creditNote.creditNoteOfId).toBe(original.id);
    expect(toNumber(creditNote.totalIncl)).toBe(-toNumber(original.totalIncl));

    expect(replacement.kind).toBe("invoice");
    expect(replacement.status).toBe("concept");
    expect(replacement.number).toBeNull();
    expect(replacement.correctionOfId).toBe(original.id);
    expect(replacement.lines).toHaveLength(original.lines.length);
    expect(replacement.lines.some((l) => l.kind === "text" && l.description === "Afspraak X")).toBe(true);
    expect(toNumber(replacement.totalIncl)).toBe(toNumber(original.totalIncl));
    expect(replacement.clientName).toBe(original.clientName);
  });

  it("the original is never touched", async () => {
    const original = await sent();
    await correctInvoice(original.id, client);
    const after = await client.invoice.findUniqueOrThrow({ where: { id: original.id }, include: { lines: true } });
    expect(after.number).toBe(original.number);
    expect(toNumber(after.totalIncl)).toBe(toNumber(original.totalIncl));
    expect(after.lines).toHaveLength(original.lines.length);
  });

  it("keeps a deposit a deposit, with its percentage and basis", async () => {
    const dep = await sent("deposit", { projectId, invoiceRole: "deposit", depositType: "percentage", depositValue: 30 });
    const { replacement } = await correctInvoice(dep.id, client);
    expect(replacement.invoiceRole).toBe("deposit");
    expect(toNumber(replacement.depositPercentage)).toBe(30);
    expect(toNumber(replacement.depositBasisExcl)).toBe(toNumber(dep.depositBasisExcl));
  });

  it("refuses a concept, a credit note, and a second correction", async () => {
    const draft = await createDraftInvoice({ projectId, invoiceRole: "standalone" }, client);
    await expect(correctInvoice(draft.id, client)).rejects.toMatchObject({ code: "NOT_SENT" });

    const original = await sent();
    const { creditNote } = await correctInvoice(original.id, client);
    await expect(correctInvoice(creditNote.id, client)).rejects.toMatchObject({ code: "NOT_APPLICABLE" });
    await expect(correctInvoice(original.id, client)).rejects.toBeInstanceOf(CorrectInvoiceError);
  });

  it("refuses an invoice that already has a credit note, even a draft one", async () => {
    const original = await sent();
    await createCreditNote(original.id, undefined, client);
    await expect(correctInvoice(original.id, client)).rejects.toMatchObject({ code: "ALREADY_CREDITED" });
  });

  it("refuses a deposit that a final invoice has already deducted", async () => {
    const dep = await sent("deposit", { projectId, invoiceRole: "deposit", depositType: "fixed", depositValue: 100 });
    const final = await createDraftInvoice({ projectId, invoiceRole: "final" }, client);
    expect(final.lines.some((l) => l.kind === "deduction" && l.sourceId === dep.id)).toBe(true);
    await finalizeInvoice(final.id, client);
    await expect(correctInvoice(dep.id, client)).rejects.toMatchObject({ code: "DEPOSIT_DEDUCTED" });
  });
});

describe("finalising a correction (C1b)", () => {
  it("finalising the replacement sends the credit note with it, in the same step", async () => {
    const original = await sent();
    const { creditNote, replacement } = await correctInvoice(original.id, client);
    const out = await finalizeInvoice(replacement.id, client);

    expect(out.status).toBe("verzonden");
    expect(out.number).toBeTruthy();
    const cn = await client.invoice.findUniqueOrThrow({ where: { id: creditNote.id } });
    expect(cn.status).toBe("verzonden");
    expect(cn.number).toMatch(/^CN-/);
    expect(cn.paymentReference).toBeNull();
  });

  it("finalising the credit note alone sends the replacement too", async () => {
    const original = await sent();
    const { creditNote, replacement } = await correctInvoice(original.id, client);
    await finalizeInvoice(creditNote.id, client);
    const rep = await client.invoice.findUniqueOrThrow({ where: { id: replacement.id } });
    expect(rep.status).toBe("verzonden");
  });

  it("payments on the credited original move to the replacement", async () => {
    const original = await sent();
    await recordPayment(original.id, { amount: toNumber(original.totalIncl), paidAt: "2026-07-01" }, client);
    const { replacement } = await correctInvoice(original.id, client);
    await finalizeInvoice(replacement.id, client);

    const moved = await client.payment.findMany({ where: { invoiceId: replacement.id } });
    expect(moved).toHaveLength(1);
    expect(await client.payment.count({ where: { invoiceId: original.id } })).toBe(0);
    // Same total → the replacement is already fully paid.
    expect((await client.invoice.findUniqueOrThrow({ where: { id: replacement.id } })).status).toBe("betaald");
  });

  it("a replacement whose credit note was deleted can't go out alone", async () => {
    const original = await sent();
    const { creditNote, replacement } = await correctInvoice(original.id, client);
    await client.invoice.delete({ where: { id: creditNote.id } });
    await expect(finalizeInvoice(replacement.id, client)).rejects.toMatchObject({ code: "CORRECTION_INCOMPLETE" });
    expect((await client.invoice.findUniqueOrThrow({ where: { id: replacement.id } })).status).toBe("concept");
  });

  it("an ordinary invoice still finalises on its own", async () => {
    const draft = await createDraftInvoice({ projectId, invoiceRole: "standalone" }, client);
    await expect(finalizeInvoice(draft.id, client)).resolves.toMatchObject({ status: "verzonden" });
    await expect(finalizeInvoice(draft.id, client)).rejects.toBeInstanceOf(FinalizeInvoiceError);
  });
});

describe("credit notes can't credit the same line twice (C1b)", () => {
  it("a second full credit note is refused; a partial one only gets what is left", async () => {
    const original = await sent();
    await createCreditNote(original.id, undefined, client);
    await expect(createCreditNote(original.id, undefined, client)).rejects.toBeInstanceOf(CreditNoteError);

    const other = await sent();
    const line = other.lines.find((l) => l.kind === "person")!;
    const qty = toNumber(line.quantity);
    await createCreditNote(other.id, [{ lineId: line.id, quantity: qty - 0.5 }], client);
    await expect(createCreditNote(other.id, [{ lineId: line.id, quantity: 1 }], client)).rejects.toMatchObject({ code: "INVALID_QUANTITY" });
    await expect(createCreditNote(other.id, [{ lineId: line.id, quantity: 0.5 }], client)).resolves.toBeTruthy();
  });
});
