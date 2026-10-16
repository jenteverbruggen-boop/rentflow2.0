import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

vi.stubEnv("DATABASE_URL", `file:/tmp/regenerate-invoice-init.db`);
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
import { regenerateInvoice, RegenerateNotAllowedError } from "@/lib/regenerate-invoice";
import { addManualLine } from "@/lib/invoice-lines-crud";
import { isInvoiceStale } from "@/lib/invoice-stale";
import { refreshInvoiceClient } from "@/lib/refresh-invoice-client";
import { isValidStructuredReference } from "@/lib/invoice-reference";
import { serializeInvoice, invoiceInclude } from "@/lib/serialize-invoice";
import { toNumber } from "@/lib/serialize";

const DB_PATH = path.join(os.tmpdir(), `regenerate-invoice-${process.pid}.db`);
const DB_URL = `file:${DB_PATH}`;

let client: PrismaClient;
let projectId: number;
let periodId: number;
let clientId: number;

beforeAll(async () => {
  execSync(`DATABASE_URL=${DB_URL} npx prisma db push --schema=prisma/schema.dev.prisma`, { stdio: "pipe" });
  const adapter = new PrismaLibSql({ url: DB_URL });
  client = new PrismaClient({ adapter } as never);
  Object.assign(mockedPrisma as object, client);

  const clientRow = await client.client.create({ data: { name: "Regenerate Test Client" } });
  const person = await client.person.create({ data: { name: "Jan Peeters", dayPrice: 200 } });
  const project = await client.project.create({
    include: { periods: true },
    data: {
      name: "Regenerate Test Project", clientId: clientRow.id,
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
  periodId = project.periods[0].id;
  clientId = clientRow.id;
}, 60_000);

afterAll(async () => {
  await client.$disconnect();
  fs.rmSync(DB_PATH, { force: true });
});

describe("regenerateInvoice", () => {
  it("refuses to regenerate a concept credit note and leaves its negative lines alone", async () => {
    const draft = await createDraftInvoice({ projectId, invoiceRole: "standalone" }, client);
    const sent = await finalizeInvoice(draft.id, client);
    const cn = await createCreditNote(sent.id, undefined, client);

    await expect(regenerateInvoice(cn.id, client)).rejects.toBeInstanceOf(RegenerateNotAllowedError);

    const after = await client.invoiceLine.findMany({ where: { invoiceId: cn.id } });
    expect(after.length).toBeGreaterThan(0);
    expect(after.every((l) => toNumber(l.lineTotalExcl) < 0)).toBe(true);
  });

  it("still regenerates a normal concept invoice", async () => {
    const draft = await createDraftInvoice({ projectId, invoiceRole: "standalone" }, client);
    const result = await regenerateInvoice(draft.id, client);
    expect(result.kind).toBe("invoice");
    expect(result.lines.length).toBeGreaterThan(0);
  });
});

async function stale(id: number) {
  const inv = await client.invoice.findUniqueOrThrow({ where: { id }, include: { lines: true } });
  return isInvoiceStale(inv, client);
}

describe("C1a — keep own lines, detect project changes", () => {
  it("regenerate keeps free and text lines (in order, with totals) and replaces the generated ones", async () => {
    const draft = await createDraftInvoice({ projectId, invoiceRole: "standalone" }, client);
    await addManualLine(draft.id, { description: "Vervoer", quantity: 1, unit: "stuk", unitPrice: 75 }, client);
    await addManualLine(draft.id, { kind: "text", description: "Extra afspraak" }, client);
    const generated = draft.lines.find((l) => l.kind === "person")!;
    await client.invoiceLine.update({ where: { id: generated.id }, data: { description: "Handmatig aangepast" } });

    const after = await regenerateInvoice(draft.id, client);
    const kinds = after.lines.sort((a, b) => a.sortOrder - b.sortOrder).map((l) => l.kind);
    expect(kinds.slice(-2)).toEqual(["manual", "text"]);
    expect(after.lines.some((l) => l.description === "Handmatig aangepast")).toBe(false); // generated edit is gone
    expect(toNumber(after.subtotalExcl)).toBe(toNumber(draft.subtotalExcl) + 75);
  });

  it("a fresh draft isn't stale; a project change makes it stale; regenerating clears it", async () => {
    const draft = await createDraftInvoice({ projectId, invoiceRole: "standalone" }, client);
    expect(draft.generatedHash).toBeTruthy();
    expect(await stale(draft.id)).toBe(false);

    const extra = await client.person.create({ data: { name: "Piet Extra", dayPrice: 150 } });
    await client.periodPerson.create({ data: { periodId, personId: extra.id, dayPriceSnapshot: 150 } });
    expect(await stale(draft.id)).toBe(true);

    await regenerateInvoice(draft.id, client);
    expect(await stale(draft.id)).toBe(false);
    await client.periodPerson.deleteMany({ where: { personId: extra.id } });
  });

  it("an inline edit or a free line never flags the draft as stale", async () => {
    const draft = await createDraftInvoice({ projectId, invoiceRole: "standalone" }, client);
    await client.invoiceLine.update({ where: { id: draft.lines[0].id }, data: { unitPrice: 1 } });
    await addManualLine(draft.id, { description: "Korting", quantity: 1, unit: "stuk", unitPrice: -10 }, client);
    expect(await stale(draft.id)).toBe(false);
  });

  it("a fixed-amount deposit never goes stale (it doesn't depend on the project)", async () => {
    const draft = await createDraftInvoice(
      { projectId, invoiceRole: "deposit", depositType: "fixed", depositValue: 500 }, client,
    );
    const extra = await client.person.create({ data: { name: "Els Extra", dayPrice: 90 } });
    await client.periodPerson.create({ data: { periodId, personId: extra.id, dayPriceSnapshot: 90 } });
    expect(await stale(draft.id)).toBe(false);
    await client.periodPerson.deleteMany({ where: { personId: extra.id } });
  });
});

describe("C1a — finalize: payment term, OGM, refresh client", () => {
  it("a per-invoice payment term wins over the setting, and the invoice gets a valid OGM", async () => {
    const draft = await createDraftInvoice({ projectId, invoiceRole: "standalone" }, client);
    await client.invoice.update({ where: { id: draft.id }, data: { paymentTermDays: 14 } });
    const sent = await finalizeInvoice(draft.id, client);
    const days = Math.round((sent.dueDate!.getTime() - sent.invoiceDate!.getTime()) / 86_400_000);
    expect(days).toBe(14);
    expect(isValidStructuredReference(sent.paymentReference!)).toBe(true);
  });

  it("a credit note gets no OGM, and names the invoice it corrects", async () => {
    const draft = await createDraftInvoice({ projectId, invoiceRole: "standalone" }, client);
    const sent = await finalizeInvoice(draft.id, client);
    const cn = await createCreditNote(sent.id, undefined, client);
    const sentCn = await finalizeInvoice(cn.id, client);
    expect(sentCn.paymentReference).toBeNull();
    const reloaded = await client.invoice.findUniqueOrThrow({ where: { id: cn.id }, include: invoiceInclude });
    const wire = serializeInvoice(reloaded);
    expect(wire.creditNoteOfNumber).toBe(sent.number);
    expect(wire.creditNoteOfDate).toBe(sent.invoiceDate!.toISOString());
  });

  it("refresh-client re-copies the project's current client onto a draft, and refuses a sent invoice", async () => {
    const draft = await createDraftInvoice({ projectId, invoiceRole: "standalone" }, client);
    await client.client.update({ where: { id: clientId }, data: { address: "Nieuwstraat 1", city: "Gent" } });
    const refreshed = await refreshInvoiceClient(draft.id, client);
    expect(refreshed.clientAddress).toBe("Nieuwstraat 1");
    expect(refreshed.clientCity).toBe("Gent");

    const sent = await finalizeInvoice(draft.id, client);
    await client.client.update({ where: { id: clientId }, data: { address: "Andere straat 9" } });
    await expect(refreshInvoiceClient(sent.id, client)).rejects.toThrow();
  });
});
