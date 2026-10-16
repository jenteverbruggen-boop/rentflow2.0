import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

vi.stubEnv("DATABASE_URL", `file:/tmp/quotes-init.db`);
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { execSync } from "child_process";
import os from "os";
import path from "path";
import fs from "fs";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "@/generated/prisma/client";
import { prisma as mockedPrisma } from "@/lib/prisma";
import { createQuote } from "@/lib/create-quote";
import { sendQuote, reopenQuote, rejectQuote } from "@/lib/quote-lifecycle";
import { acceptQuote } from "@/lib/accept-quote";
import { convertQuote } from "@/lib/convert-quote";
import { QuoteError } from "@/lib/quote-error";
import { createDraftInvoice } from "@/lib/create-draft-invoice";
import { finalizeInvoice, FinalizeInvoiceError } from "@/lib/finalize-invoice";
import { createCreditNote } from "@/lib/create-credit-note";
import { recordPayment } from "@/lib/invoice-payments";
import { regenerateInvoice, RegenerateNotAllowedError } from "@/lib/regenerate-invoice";
import { isInvoiceStale } from "@/lib/invoice-stale";
import { addManualLine } from "@/lib/invoice-lines-crud";
import { fetchInvoicesExportRows } from "@/lib/invoices-export";
import { computeStats } from "@/lib/compute-stats";
import { deleteProject, ProjectInUseError } from "@/lib/delete-project";
import { toNumber } from "@/lib/serialize";

const DB_PATH = path.join(os.tmpdir(), `quotes-${process.pid}.db`);
const DB_URL = `file:${DB_PATH}`;

let client: PrismaClient;
let clientId: number;
let personId: number;
let materialId: number;

beforeAll(async () => {
  execSync(`DATABASE_URL=${DB_URL} npx prisma db push --schema=prisma/schema.dev.prisma`, { stdio: "pipe" });
  client = new PrismaClient({ adapter: new PrismaLibSql({ url: DB_URL }) } as never);
  Object.assign(mockedPrisma as object, client);
  clientId = (await client.client.create({ data: { name: "Quote Client", address: "Oude straat 1" } })).id;
  personId = (await client.person.create({ data: { name: "Jan Peeters", dayPrice: 200 } })).id;
  materialId = (await client.material.create({ data: { name: "Tent", dayPrice: 80 } })).id;
}, 60_000);

afterAll(async () => {
  await client.$disconnect();
  fs.rmSync(DB_PATH, { force: true });
});

async function project(status = "concept") {
  const p = await client.project.create({
    data: {
      name: `Offerte project ${Math.random()}`, clientId, status,
      startDate: new Date("2026-06-01"), endDate: new Date("2026-06-01"),
      periods: {
        create: [{
          name: "Event", startDate: new Date("2026-06-01"), endDate: new Date("2026-06-01"),
          people: { create: [{ personId, dayPriceSnapshot: 200 }] },
        }],
      },
    },
    include: { periods: true },
  });
  return p;
}

async function sentQuote(projectId: number) {
  const q = await createQuote(projectId, client);
  await addManualLine(q.id, { description: "Korting", quantity: 1, unit: "stuk", unitPrice: -50, vatRate: 6 }, client);
  await addManualLine(q.id, { kind: "text", description: "Betaling in 2 schijven" }, client);
  return sendQuote(q.id, client);
}

const invoiceCounter = () => client.invoiceCounter.findMany({ where: { series: "invoice" } });

describe("quotes — create, number, send", () => {
  it("creates a draft quote (own series, no number yet), even for an overbooked project", async () => {
    const p = await project();
    await client.periodMaterialShortage.create({
      data: { periodId: p.periods[0].id, materialId, quantity: 3, dayPriceSnapshot: 80 },
    });
    const q = await createQuote(p.id, client);
    expect(q).toMatchObject({ kind: "offerte", series: "quote", status: "concept", number: null, invoiceRole: "standalone" });
    expect(q.lines.some((l) => l.kind === "material" && toNumber(l.quantity) === 3)).toBe(true);
  });

  it("refuses a project without a client", async () => {
    const p = await client.project.create({ data: { name: "Zonder klant", startDate: new Date("2026-06-01"), endDate: new Date("2026-06-01") } });
    await expect(createQuote(p.id, client)).rejects.toMatchObject({ code: "NO_CLIENT" });
  });

  it("sending allocates OF-<year>-NNNN from its own counter and sets the validity date", async () => {
    const before = await invoiceCounter();
    const q = await sendQuote((await createQuote((await project()).id, client)).id, client);
    expect(q.status).toBe("verzonden");
    expect(q.number).toMatch(/^OF-\d{4}-0001$|^OF-\d{4}-\d{4}$/);
    const days = Math.round((q.validUntil!.getTime() - q.invoiceDate!.getTime()) / 86_400_000);
    expect(days).toBe(30);
    expect(await invoiceCounter()).toEqual(before); // the legal invoice series is untouched
    const next = await sendQuote((await createQuote((await project()).id, client)).id, client);
    expect(Number(next.number!.slice(-4))).toBe(Number(q.number!.slice(-4)) + 1);
  });

  it("a per-quote validity (paymentTermDays) wins over the setting", async () => {
    const created = await createQuote((await project()).id, client);
    await client.invoice.update({ where: { id: created.id }, data: { paymentTermDays: 10 } });
    const q = await sendQuote(created.id, client);
    expect(Math.round((q.validUntil!.getTime() - q.invoiceDate!.getTime()) / 86_400_000)).toBe(10);
  });

  it("reopening keeps the number; sending again doesn't draw a new one", async () => {
    const q = await sendQuote((await createQuote((await project()).id, client)).id, client);
    const reopened = await reopenQuote(q.id, client);
    expect(reopened.status).toBe("concept");
    expect(reopened.number).toBe(q.number);
    expect((await sendQuote(q.id, client)).number).toBe(q.number);
  });

  it("only a sent quote can be refused, and a refused quote is final", async () => {
    const draft = await createQuote((await project()).id, client);
    await expect(rejectQuote(draft.id, client)).rejects.toMatchObject({ code: "WRONG_STATUS" });
    const sent = await sendQuote(draft.id, client);
    expect((await rejectQuote(sent.id, client)).status).toBe("geweigerd");
    await expect(reopenQuote(sent.id, client)).rejects.toMatchObject({ code: "WRONG_STATUS" });
  });
});

describe("quotes are never invoices", () => {
  it("finalizing a quote is refused and leaves the invoice counter alone", async () => {
    const q = await createQuote((await project()).id, client);
    const before = await invoiceCounter();
    await expect(finalizeInvoice(q.id, client)).rejects.toMatchObject({ code: "NOT_AN_INVOICE" });
    await expect(finalizeInvoice(q.id, client)).rejects.toBeInstanceOf(FinalizeInvoiceError);
    expect(await invoiceCounter()).toEqual(before);
  });

  it("a sent quote takes no payments and no credit note", async () => {
    const q = await sentQuote((await project()).id);
    await expect(recordPayment(q.id, { amount: 10, paidAt: "2026-07-01" }, client)).rejects.toMatchObject({ code: "CREDIT_NOTE" });
    await expect(createCreditNote(q.id, undefined, client)).rejects.toBeInstanceOf(Error);
  });

  it("a sent quote is not invoiced revenue and not in the invoice export", async () => {
    const q = await sentQuote((await project()).id);
    // Make sure its invoice date falls inside the stats window.
    await client.invoice.update({ where: { id: q.id }, data: { invoiceDate: new Date("2026-06-15T10:00:00Z") } });
    const stats = await computeStats({ from: new Date("2026-06-01"), to: new Date("2026-06-30") }, client);
    expect(stats.revenueByMonth.reduce((s, m) => s + m.invoiced, 0)).toBe(0);
    const rows = await fetchInvoicesExportRows(client);
    expect(rows.some((r) => r.number === q.number)).toBe(false);
  });
});

describe("accepting a quote", () => {
  it("moves the quote to aanvaard and a concept project to bevestigd", async () => {
    const p = await project();
    const q = await sentQuote(p.id);
    const accepted = await acceptQuote(q.id, client);
    expect(accepted.status).toBe("aanvaard");
    expect(accepted.acceptedAt).toBeTruthy();
    expect((await client.project.findUniqueOrThrow({ where: { id: p.id } })).status).toBe("bevestigd");
  });

  it("never downgrades a project that is further along", async () => {
    const p = await project("actief");
    await acceptQuote((await sentQuote(p.id)).id, client);
    expect((await client.project.findUniqueOrThrow({ where: { id: p.id } })).status).toBe("actief");
  });

  it("is refused for a cancelled project, an unsent quote, and a second accepted quote", async () => {
    const cancelled = await project("geannuleerd");
    await expect(acceptQuote((await sentQuote(cancelled.id)).id, client)).rejects.toMatchObject({ code: "PROJECT_CANCELLED" });

    const draft = await createQuote((await project()).id, client);
    await expect(acceptQuote(draft.id, client)).rejects.toMatchObject({ code: "WRONG_STATUS" });

    const p = await project();
    await acceptQuote((await sentQuote(p.id)).id, client);
    await expect(acceptQuote((await sentQuote(p.id)).id, client)).rejects.toMatchObject({ code: "ALREADY_ACCEPTED" });
  });

  it("an overbooked concept project can't be confirmed — and nothing is written", async () => {
    const p = await project();
    await client.periodMaterialShortage.create({ data: { periodId: p.periods[0].id, materialId, quantity: 2, dayPriceSnapshot: 80 } });
    const q = await sentQuote(p.id);
    await expect(acceptQuote(q.id, client)).rejects.toMatchObject({ code: "OVERBOOK" });
    expect((await client.invoice.findUniqueOrThrow({ where: { id: q.id } })).status).toBe("verzonden");
    expect((await client.project.findUniqueOrThrow({ where: { id: p.id } })).status).toBe("concept");
  });
});

describe("converting a quote to an invoice", () => {
  async function accepted() {
    const p = await project();
    const q = await acceptQuote((await sentQuote(p.id)).id, client);
    return { p, q };
  }

  it("full: copies the quote's lines verbatim — free lines, text and per-line VAT included", async () => {
    const { q } = await accepted();
    await client.client.update({ where: { id: clientId }, data: { address: "Nieuwe straat 9" } });
    const inv = await convertQuote(q.id, { mode: "full" }, client);

    expect(inv).toMatchObject({ kind: "invoice", status: "concept", invoiceRole: "standalone", sourceQuoteId: q.id });
    const quoteLines = await client.invoiceLine.findMany({ where: { invoiceId: q.id }, orderBy: { sortOrder: "asc" } });
    expect(inv.lines.map((l) => [l.kind, l.description, toNumber(l.unitPrice), toNumber(l.vatRate)]).sort())
      .toEqual(quoteLines.map((l) => [l.kind, l.description, toNumber(l.unitPrice), toNumber(l.vatRate)]).sort());
    expect(inv.lines.find((l) => l.description === "Korting")).toMatchObject({ kind: "manual" });
    expect(toNumber(inv.vatAmount)).toBeCloseTo(toNumber(q.vatAmount), 2);
    expect(inv.clientAddress).toBe("Nieuwe straat 9"); // the snapshot is re-read, the lines are not
  });

  it("a quote is invoiced once, and its invoice can't be regenerated from the project", async () => {
    const { q } = await accepted();
    const inv = await convertQuote(q.id, { mode: "full" }, client);
    await expect(convertQuote(q.id, { mode: "full" }, client)).rejects.toMatchObject({ code: "ALREADY_CONVERTED" });
    await expect(convertQuote(q.id, { mode: "deposit", depositType: "fixed", depositValue: 10 }, client)).rejects.toMatchObject({ code: "ALREADY_CONVERTED" });
    await expect(regenerateInvoice(inv.id, client)).rejects.toBeInstanceOf(RegenerateNotAllowedError);
    const row = await client.invoice.findUniqueOrThrow({ where: { id: inv.id }, include: { lines: true } });
    expect(await isInvoiceStale(row, client)).toBe(false);
  });

  it("a credited conversion frees the quote to be invoiced again", async () => {
    const { q } = await accepted();
    const inv = await convertQuote(q.id, { mode: "full" }, client);
    const sent = await finalizeInvoice(inv.id, client);
    const cn = await createCreditNote(sent.id, undefined, client);
    await finalizeInvoice(cn.id, client);
    await expect(convertQuote(q.id, { mode: "full" }, client)).resolves.toMatchObject({ sourceQuoteId: q.id });
  });

  it("only an accepted quote can be converted", async () => {
    const q = await sentQuote((await project()).id);
    await expect(convertQuote(q.id, { mode: "full" }, client)).rejects.toMatchObject({ code: "NOT_ACCEPTED" });
  });

  it("deposit → final: the deposit is a % of the quote total, the final invoice re-bills the quote minus it", async () => {
    const { q } = await accepted();
    const basis = toNumber(q.subtotalExcl) + toNumber(q.travelExcl);

    await expect(convertQuote(q.id, { mode: "final" }, client)).rejects.toMatchObject({ code: "NO_DEPOSIT" });
    const deposit = await convertQuote(q.id, { mode: "deposit", depositType: "percentage", depositValue: 30 }, client);
    expect(deposit.invoiceRole).toBe("deposit");
    expect(toNumber(deposit.depositBasisExcl)).toBeCloseTo(basis, 2);
    expect(toNumber(deposit.subtotalExcl)).toBeCloseTo(basis * 0.3, 2);

    // A concept deposit isn't invoiced yet, so a final invoice still has to wait.
    await expect(convertQuote(q.id, { mode: "final" }, client)).rejects.toMatchObject({ code: "NO_DEPOSIT" });
    await finalizeInvoice(deposit.id, client);

    const final = await convertQuote(q.id, { mode: "final" }, client);
    expect(final.invoiceRole).toBe("final");
    expect(final.lines.some((l) => l.kind === "deduction" && l.sourceId === deposit.id)).toBe(true);
    expect(toNumber(final.deductionExcl)).toBeCloseTo(-basis * 0.3, 2);
    expect(toNumber(final.subtotalExcl) + toNumber(final.travelExcl)).toBeCloseTo(basis, 2);
    // …and the quote is now fully spoken for.
    await expect(convertQuote(q.id, { mode: "full" }, client)).rejects.toBeInstanceOf(QuoteError);
    await expect(convertQuote(q.id, { mode: "deposit", depositType: "fixed", depositValue: 5 }, client)).rejects.toBeInstanceOf(QuoteError);
  });
});

describe("deleting a project with quotes", () => {
  it("takes never-sent and refused quotes with it", async () => {
    const p = await project();
    await createQuote(p.id, client);
    const refused = await sendQuote((await createQuote(p.id, client)).id, client);
    await rejectQuote(refused.id, client);
    await deleteProject(p.id, client);
    expect(await client.project.findUnique({ where: { id: p.id } })).toBeNull();
  });

  it("is refused while a sent quote or an invoice points at the project", async () => {
    const p = await project();
    await sendQuote((await createQuote(p.id, client)).id, client);
    await expect(deleteProject(p.id, client)).rejects.toBeInstanceOf(ProjectInUseError);
    expect(await client.project.findUnique({ where: { id: p.id } })).not.toBeNull();
    // the refusal rolled back the deletion of its concept siblings too
    const p2 = await project();
    await createQuote(p2.id, client);
    await createDraftInvoice({ projectId: p2.id, invoiceRole: "standalone" }, client);
    await expect(deleteProject(p2.id, client)).rejects.toBeInstanceOf(ProjectInUseError);
    expect(await client.invoice.count({ where: { projectId: p2.id, kind: "offerte" } })).toBe(1);
  });
});
