import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

vi.stubEnv("DATABASE_URL", `file:/tmp/pipeline-init.db`);
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { execSync } from "child_process";
import os from "os";
import path from "path";
import fs from "fs";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "@/generated/prisma/client";
import { prisma as mockedPrisma } from "@/lib/prisma";
import { buildImportPreview, applyImport } from "@/lib/import/pipeline";
import { personAdapter } from "@/lib/import/adapters/person";
import { clientAdapter } from "@/lib/import/adapters/client";
import { locationAdapter } from "@/lib/import/adapters/location";
import { materialAdapter } from "@/lib/import/adapters/material";
import { resolveImportEntity } from "@/lib/import/entity-registry";

const DB_PATH = path.join(os.tmpdir(), `pipeline-${process.pid}.db`);
const DB_URL = `file:${DB_PATH}`;

let client: PrismaClient;

beforeAll(async () => {
  execSync(`DATABASE_URL=${DB_URL} npx prisma db push --schema=prisma/schema.dev.prisma`, { stdio: "pipe" });
  const adapter = new PrismaLibSql({ url: DB_URL });
  client = new PrismaClient({ adapter } as never);
  Object.assign(mockedPrisma as object, client);
}, 60_000);

afterAll(async () => {
  await client.$disconnect();
  fs.rmSync(DB_PATH, { force: true });
});

describe("resolveImportEntity — invoices never listed (design doc §1.6)", () => {
  it("returns null for an invoices entity param", () => {
    expect(resolveImportEntity("invoices")).toBeNull();
  });
  it("resolves the four real entities", () => {
    expect(resolveImportEntity("materials")).toBe("materials");
    expect(resolveImportEntity("people")).toBe("people");
    expect(resolveImportEntity("clients")).toBe("clients");
    expect(resolveImportEntity("locations")).toBe("locations");
  });
});

describe("update mode — people/clients/locations adapters (P3.2)", () => {
  it("creates a new person via the generic pipeline, matched by id", async () => {
    const rows = [{ name: "Nieuwe Persoon", email: "np@test.dev", dayPrice: "300" }];
    const preview = await buildImportPreview(personAdapter, rows, "rentflow", "update", client);
    expect(preview.totals.new).toBe(1);

    const result = await applyImport(personAdapter, rows, "rentflow", "update", { userId: 1, fileName: "t.csv" }, client);
    if ("blockers" in result) throw new Error("unexpected blockers");
    expect(result.created).toBe(1);
    const created = await client.person.findFirst({ where: { name: "Nieuwe Persoon" } });
    expect(created).not.toBeNull();
  });

  it("updates an existing client matched by id, unchanged fields stay untouched", async () => {
    const existing = await client.client.create({ data: { name: "Acme", city: "Gent" } });
    const rows = [{ id: String(existing.id), name: "Acme BV", city: "Gent" }];
    const result = await applyImport(clientAdapter, rows, "rentflow", "update", { userId: 1, fileName: "t.csv" }, client);
    if ("blockers" in result) throw new Error("unexpected blockers");
    expect(result.updated).toBe(1);
    const after = await client.client.findUnique({ where: { id: existing.id } });
    expect(after?.name).toBe("Acme BV");
    expect(after?.city).toBe("Gent");
  });

  it("a row with no name errors without aborting the rest of the file", async () => {
    const rows = [{ name: "", city: "Gent" }, { name: "Valid Location", city: "Brugge" }];
    const preview = await buildImportPreview(locationAdapter, rows, "rentflow", "update", client);
    expect(preview.totals.errored).toBe(1);
    expect(preview.totals.new).toBe(1);
  });
});

describe("replace mode — referential guards (P3.3, Q49b)", () => {
  it("refuses a replace when a material has bookings, lists the exact blocker, and changes nothing", async () => {
    const cat = await client.category.create({ data: { name: "Test Cat", prefix: "0901" } });
    const material = await client.material.create({ data: { name: "Booked Tent", code: "0901-001", categoryId: cat.id } });
    const stockItem = await client.stockItem.create({ data: { materialId: material.id, unitNumber: 1 } });
    const project = await client.project.create({
      data: { name: "Test Project", startDate: new Date("2026-06-01"), endDate: new Date("2026-06-05") },
    });
    const period = await client.period.create({
      data: { projectId: project.id, name: "Main", startDate: new Date("2026-06-01"), endDate: new Date("2026-06-05") },
    });
    await client.periodStockItem.create({ data: { periodId: period.id, stockItemId: stockItem.id, dayPriceSnapshot: 50 } });

    const beforeCount = await client.material.count();
    const rows = [{ name: "Replacement Tent", code: "0901-002", dayPrice: "80" }];
    const result = await applyImport(materialAdapter, rows, "rentflow", "replace", { userId: 1, fileName: "t.csv" }, client);

    expect("blockers" in result).toBe(true);
    if ("blockers" in result) {
      const blocker = result.blockers.find((b) => b.entityId === material.id);
      expect(blocker).toBeDefined();
      expect(blocker!.blockedBy.some((b) => b.relation.includes("PeriodStockItem"))).toBe(true);
    }
    const afterCount = await client.material.count();
    expect(afterCount).toBe(beforeCount); // nothing was deleted
  });

  it("a permitted replace (no bookings) truncates and reloads, writes an ImportAudit row", async () => {
    // Fresh, isolated entity for a clean replace — locations have no
    // referential guard blockers seeded in this suite.
    await client.location.create({ data: { name: "Old Location A" } });
    await client.location.create({ data: { name: "Old Location B" } });

    const rows = [{ name: "New Location 1" }, { name: "New Location 2" }, { name: "New Location 3" }];
    const result = await applyImport(locationAdapter, rows, "rentflow", "replace", { userId: 7, fileName: "locations.csv" }, client);
    if ("blockers" in result) throw new Error("unexpected blockers");
    expect(result.deleted).toBe(2);
    expect(result.created).toBe(3);

    const locations = await client.location.findMany();
    expect(locations.map((l) => l.name).sort()).toEqual(["New Location 1", "New Location 2", "New Location 3"]);

    const audit = await client.importAudit.findFirst({ where: { entity: "locations", mode: "replace" }, orderBy: { createdAt: "desc" } });
    expect(audit).not.toBeNull();
    expect(audit?.userId).toBe(7);
    expect(audit?.fileName).toBe("locations.csv");
  });

  it("replace is refused for a client with a linked project, Project.clientId's SET NULL is not trusted as the only guard", async () => {
    const c = await client.client.create({ data: { name: "Linked Client" } });
    await client.project.create({
      data: { name: "Client Project", clientId: c.id, startDate: new Date("2026-06-01"), endDate: new Date("2026-06-05") },
    });
    const rows = [{ name: "New Client" }];
    const result = await applyImport(clientAdapter, rows, "rentflow", "replace", { userId: 1, fileName: "t.csv" }, client);
    expect("blockers" in result).toBe(true);
    if ("blockers" in result) {
      expect(result.blockers.some((b) => b.entityId === c.id)).toBe(true);
    }
    const stillThere = await client.client.findUnique({ where: { id: c.id } });
    expect(stillThere).not.toBeNull();
  });

  it("a mid-file failure during replace rolls back completely — truncate is not left half-done", async () => {
    await client.location.create({ data: { name: "Location Before Crash 1" } });
    await client.location.create({ data: { name: "Location Before Crash 2" } });
    const before = await client.location.count();

    // A deliberately broken adapter: truncates, then throws before the
    // reload completes — proves the whole $transaction rolls back
    // rather than leaving the table half-truncated.
    const crashingAdapter = {
      ...locationAdapter,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      async applyRow(...args: unknown[]): Promise<"created" | "updated" | "unchanged"> {
        throw new Error("simulated mid-file crash");
      },
    };
    // Bypass applyImport's own per-row try/catch (which deliberately
    // swallows individual row errors, §6) by driving the transaction
    // directly the same way applyImport does, to prove the transaction
    // boundary itself, not the per-row error handling.
    await expect(
      client.$transaction(async (tx) => {
        const txClient = tx as unknown as typeof client;
        await crashingAdapter.truncate(txClient);
        await crashingAdapter.applyRow(txClient, { name: "x" } as never, {});
      }),
    ).rejects.toThrow("simulated mid-file crash");

    const after = await client.location.count();
    expect(after).toBe(before); // rollback undid the truncate too
  });
});
