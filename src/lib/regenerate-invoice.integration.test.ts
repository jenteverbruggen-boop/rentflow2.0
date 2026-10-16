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
import { toNumber } from "@/lib/serialize";

const DB_PATH = path.join(os.tmpdir(), `regenerate-invoice-${process.pid}.db`);
const DB_URL = `file:${DB_PATH}`;

let client: PrismaClient;
let projectId: number;

beforeAll(async () => {
  execSync(`DATABASE_URL=${DB_URL} npx prisma db push --schema=prisma/schema.dev.prisma`, { stdio: "pipe" });
  const adapter = new PrismaLibSql({ url: DB_URL });
  client = new PrismaClient({ adapter } as never);
  Object.assign(mockedPrisma as object, client);

  const clientRow = await client.client.create({ data: { name: "Regenerate Test Client" } });
  const person = await client.person.create({ data: { name: "Jan Peeters", dayPrice: 200 } });
  const project = await client.project.create({
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
