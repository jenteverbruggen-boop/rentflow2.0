import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

vi.stubEnv("DATABASE_URL", `file:/tmp/exports-p23-init.db`);
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { execSync } from "child_process";
import os from "os";
import path from "path";
import fs from "fs";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "@/generated/prisma/client";
import { prisma as mockedPrisma } from "@/lib/prisma";
import { fetchProjectsExportRows } from "@/lib/projects-export";
import { bookingsExportColumns, fetchBookingsExportRows } from "@/lib/bookings-export";
import { fetchInvoicesExportRows } from "@/lib/invoices-export";
import type { ResolvedAccess } from "@/lib/api-auth";

const DB_PATH = path.join(os.tmpdir(), `exports-p23-${process.pid}.db`);
const DB_URL = `file:${DB_PATH}`;

let client: PrismaClient;
const ids = { alice: 0, bob: 0, ownedProject: 0, otherProject: 0 };

beforeAll(async () => {
  execSync(`DATABASE_URL=${DB_URL} npx prisma db push --schema=prisma/schema.dev.prisma`, { stdio: "pipe" });
  const adapter = new PrismaLibSql({ url: DB_URL });
  client = new PrismaClient({ adapter } as never);
  Object.assign(mockedPrisma as object, client);

  const alice = await client.person.create({ data: { name: "Alice", dayPrice: 300 } });
  const bob = await client.person.create({ data: { name: "Bob", dayPrice: 250 } });
  ids.alice = alice.id;
  ids.bob = bob.id;

  const owned = await client.project.create({
    data: { name: "Owned Project", client: "Acme", startDate: new Date("2026-06-01"), endDate: new Date("2026-06-10") },
  });
  const other = await client.project.create({
    data: { name: "Other Project", startDate: new Date("2026-07-01"), endDate: new Date("2026-07-10") },
  });
  ids.ownedProject = owned.id;
  ids.otherProject = other.id;

  const ownedPeriod = await client.period.create({
    data: { projectId: owned.id, name: "Main", startDate: new Date("2026-06-01"), endDate: new Date("2026-06-05") },
  });
  const otherPeriod = await client.period.create({
    data: { projectId: other.id, name: "Main", startDate: new Date("2026-07-01"), endDate: new Date("2026-07-05") },
  });
  await client.periodPerson.create({ data: { periodId: ownedPeriod.id, personId: alice.id, dayPriceSnapshot: 300 } });
  await client.periodPerson.create({ data: { periodId: otherPeriod.id, personId: bob.id, dayPriceSnapshot: 250 } });

  const clientRow = await client.client.create({ data: { name: "Test Client" } });
  await client.invoice.create({
    data: {
      clientId: clientRow.id,
      clientName: clientRow.name,
      status: "verzonden",
      number: "2026-0001",
      subtotalExcl: 1000,
      vatAmount: 210,
      totalIncl: 1210,
    },
  });
}, 60_000);

afterAll(async () => {
  await client.$disconnect();
  fs.rmSync(DB_PATH, { force: true });
});

describe("projects export (P2.3)", () => {
  it("scope: all sees every project", async () => {
    const rows = await fetchProjectsExportRows({ scope: "all", personId: null }, client);
    expect(rows.map((r) => r.name).sort()).toEqual(["Other Project", "Owned Project"]);
  });

  it("scope: own sees only the project they're booked on via any period (bucket a, not a blanket deny)", async () => {
    const rows = await fetchProjectsExportRows({ scope: "own", personId: ids.alice }, client);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("Owned Project");
  });
});

describe("bookings export (P2.3)", () => {
  it("flattens person bookings with project/period context, scoped the same way as projects", async () => {
    const access: ResolvedAccess = { id: 1, personId: ids.alice, scope: "own", permissions: { kosten_facturen: "lezen" } };
    const rows = await fetchBookingsExportRows(access, client);
    expect(rows).toHaveLength(1);
    expect(rows[0].entityName).toBe("Alice");
    expect(rows[0].projectId).toBe(ids.ownedProject);
  });

  it("omits money columns without Kosten/Facturen access", () => {
    const cols = bookingsExportColumns({ id: 1, personId: null, scope: "all", permissions: { kosten_facturen: "geen" } });
    expect(cols.map((c) => c.key)).not.toContain("unitPrice");
  });
});

describe("invoices export (P2.3)", () => {
  it("resolves the derived display status, real numbers not Decimal-as-string", async () => {
    const rows = await fetchInvoicesExportRows(client);
    const row = rows.find((r) => r.number === "2026-0001")!;
    expect(row.status).toBe("verzonden");
    expect(typeof row.totalIncl).toBe("number");
    expect(row.totalIncl).toBe(1210);
  });
});
