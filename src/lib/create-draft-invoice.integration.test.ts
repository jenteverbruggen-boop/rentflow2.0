import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

vi.stubEnv("DATABASE_URL", `file:/tmp/create-draft-invoice-init.db`);
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { execSync } from "child_process";
import os from "os";
import path from "path";
import fs from "fs";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "@/generated/prisma/client";
import { prisma as mockedPrisma } from "@/lib/prisma";
import { createDraftInvoice, CreateDraftInvoiceError } from "@/lib/create-draft-invoice";

const DB_PATH = path.join(os.tmpdir(), `create-draft-invoice-${process.pid}.db`);
const DB_URL = `file:${DB_PATH}`;

let client: PrismaClient;
const ids = { clientId: 0, projectId: 0, noClientProjectId: 0 };

beforeAll(async () => {
  execSync(`DATABASE_URL=${DB_URL} npx prisma db push --schema=prisma/schema.dev.prisma`, { stdio: "pipe" });
  const adapter = new PrismaLibSql({ url: DB_URL });
  client = new PrismaClient({ adapter } as never);
  Object.assign(mockedPrisma as object, client);

  const clientRow = await client.client.create({
    data: { name: "Zomerfestival Client", address: "Kaai 1", postalCode: "9000", city: "Gent", vatNumber: "BE0123456789" },
  });
  ids.clientId = clientRow.id;

  const person = await client.person.create({ data: { name: "Jan Peeters", dayPrice: 200 } });
  const project = await client.project.create({
    data: {
      name: "Zomerfestival", clientId: clientRow.id,
      startDate: new Date("2026-06-01"), endDate: new Date("2026-06-02"),
      periods: {
        create: [{
          name: "Opbouw", startDate: new Date("2026-06-01"), endDate: new Date("2026-06-02"),
          people: { create: [{ personId: person.id, dayPriceSnapshot: 200 }] },
        }],
      },
    },
  });
  ids.projectId = project.id;

  const noClientProject = await client.project.create({
    data: { name: "No client project", startDate: new Date("2026-07-01"), endDate: new Date("2026-07-02") },
  });
  ids.noClientProjectId = noClientProject.id;
}, 60_000);

afterAll(async () => {
  await client.$disconnect();
  fs.rmSync(DB_PATH, { force: true });
});

describe("createDraftInvoice (J2b.2)", () => {
  it("throws NOT_FOUND for a nonexistent project", async () => {
    await expect(createDraftInvoice({ projectId: 999999, invoiceRole: "standalone" }, client))
      .rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("throws NO_CLIENT when the project has no client", async () => {
    await expect(
      createDraftInvoice({ projectId: ids.noClientProjectId, invoiceRole: "standalone" }, client),
    ).rejects.toMatchObject({ code: "NO_CLIENT" });
    await expect(
      createDraftInvoice({ projectId: ids.noClientProjectId, invoiceRole: "standalone" }, client),
    ).rejects.toBeInstanceOf(CreateDraftInvoiceError);
  });

  it("creates a standalone draft with a snapshotted client and no number yet", async () => {
    const invoice = await createDraftInvoice({ projectId: ids.projectId, invoiceRole: "standalone" }, client);
    expect(invoice.status).toBe("concept");
    expect(invoice.number).toBeNull();
    expect(invoice.clientId).toBe(ids.clientId);
    expect(invoice.clientName).toBe("Zomerfestival Client");
    expect(invoice.clientVatNumber).toBe("BE0123456789");
    expect(invoice.lines).toHaveLength(1);
    expect(invoice.lines[0].kind).toBe("person");
    // 2-day period, dayPriceSnapshot 200 -> 400
    expect(Number(invoice.subtotalExcl)).toBe(400);
    expect(Number(invoice.vatAmount)).toBe(84); // 21% of 400
    expect(Number(invoice.totalIncl)).toBe(484);
  });

  it("creates a percentage deposit with depositBasisExcl frozen from the project total", async () => {
    const invoice = await createDraftInvoice(
      { projectId: ids.projectId, invoiceRole: "deposit", depositType: "percentage", depositValue: 30 },
      client,
    );
    expect(Number(invoice.depositBasisExcl)).toBe(400); // project total (people only here)
    expect(Number(invoice.subtotalExcl)).toBe(120); // 30% of 400
    expect(invoice.depositType).toBe("percentage");
    expect(Number(invoice.depositPercentage)).toBe(30);
  });

  it("a final invoice deducts a prior non-concept deposit, never a still-concept one", async () => {
    const stillDraftDeposit = await createDraftInvoice(
      { projectId: ids.projectId, invoiceRole: "deposit", depositType: "fixed", depositValue: 999 },
      client,
    );
    expect(stillDraftDeposit.status).toBe("concept"); // never finalised — must be ignored

    const depositDraft = await createDraftInvoice(
      { projectId: ids.projectId, invoiceRole: "deposit", depositType: "fixed", depositValue: 120 }, client,
    );
    const finalizedDeposit = await client.invoice.update({
      where: { id: depositDraft.id },
      data: { status: "verzonden", number: "2026-0001", invoiceDate: new Date("2026-06-01") },
    });

    const final = await createDraftInvoice({ projectId: ids.projectId, invoiceRole: "final" }, client);
    const deduction = final.lines.find((l) => l.kind === "deduction")!;
    expect(Number(deduction.unitPrice)).toBe(-120);
    expect(deduction.description).toContain(finalizedDeposit.number ?? "2026-0001");
    expect(Number(final.subtotalExcl)).toBe(400); // person line only — deduction is separate
    expect(Number(final.deductionExcl)).toBe(-120);
  });
});
