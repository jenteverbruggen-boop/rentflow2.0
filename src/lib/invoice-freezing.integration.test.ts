import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

vi.stubEnv("DATABASE_URL", `file:/tmp/invoice-freezing-init.db`);
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
import { addManualLine, updateInvoiceLine, deleteInvoiceLine } from "@/lib/invoice-lines-crud";
import { regenerateInvoice, InvoiceNotFoundError } from "@/lib/regenerate-invoice";

const DB_PATH = path.join(os.tmpdir(), `invoice-freezing-${process.pid}.db`);
const DB_URL = `file:${DB_PATH}`;

let client: PrismaClient;
let projectId: number;
let personId: number;

beforeAll(async () => {
  execSync(`DATABASE_URL=${DB_URL} npx prisma db push --schema=prisma/schema.dev.prisma`, { stdio: "pipe" });
  const adapter = new PrismaLibSql({ url: DB_URL });
  client = new PrismaClient({ adapter } as never);
  Object.assign(mockedPrisma as object, client);

  const clientRow = await client.client.create({ data: { name: "Freeze Test Client" } });
  const person = await client.person.create({ data: { name: "Jan Peeters", dayPrice: 200 } });
  personId = person.id;
  const project = await client.project.create({
    data: {
      name: "Freeze Test Project", clientId: clientRow.id,
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

describe("invoice freezing (J2b.4, mandatory regression test)", () => {
  it("a sent invoice's lines and totals are byte-identical after the underlying project changes", async () => {
    const draft = await createDraftInvoice({ projectId, invoiceRole: "standalone" }, client);
    const finalized = await finalizeInvoice(draft.id, client);
    const before = { lines: finalized.lines, totals: {
      subtotalExcl: finalized.subtotalExcl, travelExcl: finalized.travelExcl,
      deductionExcl: finalized.deductionExcl, vatAmount: finalized.vatAmount, totalIncl: finalized.totalIncl,
    } };

    // Mutate the underlying booking: re-snapshot the person's price to
    // a wildly different value, and rename the person.
    await client.person.update({ where: { id: personId }, data: { name: "Renamed Person", dayPrice: 9999 } });
    await client.periodPerson.updateMany({ where: { personId }, data: { dayPriceSnapshot: 9999 } });

    const after = await client.invoice.findUniqueOrThrow({
      where: { id: finalized.id },
      include: { lines: true },
    });
    expect(after.lines).toEqual(before.lines);
    expect({
      subtotalExcl: after.subtotalExcl, travelExcl: after.travelExcl,
      deductionExcl: after.deductionExcl, vatAmount: after.vatAmount, totalIncl: after.totalIncl,
    }).toEqual(before.totals);
  });

  it("rejects every line mutation and regenerate on a non-concept invoice", async () => {
    const draft = await createDraftInvoice({ projectId, invoiceRole: "standalone" }, client);
    const finalized = await finalizeInvoice(draft.id, client);

    await expect(
      addManualLine(finalized.id, { description: "x", quantity: 1, unit: "stuk", unitPrice: 1 }, client),
    ).rejects.toMatchObject({ message: expect.stringContaining("niet meer te wijzigen") });
    await expect(
      updateInvoiceLine(finalized.id, finalized.lines[0].id, { description: "y" }, client),
    ).rejects.toMatchObject({ message: expect.stringContaining("niet meer te wijzigen") });
    await expect(
      deleteInvoiceLine(finalized.id, finalized.lines[0].id, client),
    ).rejects.toMatchObject({ message: expect.stringContaining("niet meer te wijzigen") });
    await expect(regenerateInvoice(finalized.id, client)).rejects.toMatchObject({
      message: expect.stringContaining("niet meer te wijzigen"),
    });
  });

  it("a manual line on a still-concept draft recomputes totals correctly", async () => {
    const draft = await createDraftInvoice({ projectId, invoiceRole: "standalone" }, client);
    const before = draft.subtotalExcl;
    await addManualLine(draft.id, { description: "Extra", quantity: 2, unit: "stuk", unitPrice: 50 }, client);
    const updated = await client.invoice.findUniqueOrThrow({ where: { id: draft.id } });
    expect(Number(updated.subtotalExcl)).toBe(Number(before) + 100);
  });

  it("regenerate on a still-concept draft discards a manual line and re-derives from the live project", async () => {
    const draft = await createDraftInvoice({ projectId, invoiceRole: "standalone" }, client);
    await addManualLine(draft.id, { description: "Manual extra", quantity: 1, unit: "stuk", unitPrice: 1000 }, client);

    const regenerated = await regenerateInvoice(draft.id, client);
    expect(regenerated.lines.some((l) => l.description === "Manual extra")).toBe(false);
    expect(Number(regenerated.subtotalExcl)).toBe(Number(draft.subtotalExcl));
  });

  it("regenerate throws NOT_FOUND for a nonexistent invoice", async () => {
    await expect(regenerateInvoice(999999, client)).rejects.toBeInstanceOf(InvoiceNotFoundError);
  });
});
