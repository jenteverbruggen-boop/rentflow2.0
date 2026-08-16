import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

vi.stubEnv("DATABASE_URL", `file:/tmp/exports-init.db`);
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { execSync } from "child_process";
import os from "os";
import path from "path";
import fs from "fs";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "@/generated/prisma/client";
import { prisma as mockedPrisma } from "@/lib/prisma";
import { materialsExportColumns, fetchMaterialsExportRows } from "@/lib/materials-export";
import { peopleExportColumns, fetchPeopleExportRows } from "@/lib/people-export";
import { fetchClientsExportRows } from "@/lib/clients-export";
import { fetchLocationsExportRows } from "@/lib/locations-export";
import type { ResolvedAccess } from "@/lib/api-auth";

const DB_PATH = path.join(os.tmpdir(), `exports-${process.pid}.db`);
const DB_URL = `file:${DB_PATH}`;

let client: PrismaClient;

beforeAll(async () => {
  execSync(`DATABASE_URL=${DB_URL} npx prisma db push --schema=prisma/schema.dev.prisma`, { stdio: "pipe" });
  const adapter = new PrismaLibSql({ url: DB_URL });
  client = new PrismaClient({ adapter } as never);
  Object.assign(mockedPrisma as object, client);

  const fn = await client.function.create({ data: { name: "Electrician" } });
  const person = await client.person.create({ data: { name: "Alice", dayPrice: 300 } });
  await client.personFunction.create({ data: { personId: person.id, functionId: fn.id } });

  const cat = await client.category.create({ data: { name: "Tenten", prefix: "0501" } });
  await client.material.create({
    data: { name: "Tent 4x8", categoryId: cat.id, dayPrice: 45, costPrice: 20, code: "0501-001" },
  });
  await client.material.create({
    data: { name: "Old Tent", dayPrice: 30, archived: true, code: "0501-002" },
  });

  await client.client.create({ data: { name: "Summer Sounds vzw", vatNumber: "BE0123456789" } });
  await client.location.create({ data: { name: "Gent", city: "Gent" } });
}, 60_000);

afterAll(async () => {
  await client.$disconnect();
  fs.rmSync(DB_PATH, { force: true });
});

const withMoney: ResolvedAccess = {
  id: 1,
  personId: null,
  scope: "all",
  permissions: { kosten_facturen: "lezen" },
};
const withoutMoney: ResolvedAccess = {
  id: 2,
  personId: null,
  scope: "all",
  permissions: { kosten_facturen: "geen" },
};

describe("materials export (P2.2)", () => {
  it("excludes archived materials by default", async () => {
    const rows = await fetchMaterialsExportRows(false, client);
    expect(rows.find((r) => r.name === "Old Tent")).toBeUndefined();
    expect(rows.find((r) => r.name === "Tent 4x8")).toBeDefined();
  });

  it("includes archived materials when asked", async () => {
    const rows = await fetchMaterialsExportRows(true, client);
    expect(rows.find((r) => r.name === "Old Tent")).toBeDefined();
  });

  it("includes money columns for a caller with Kosten/Facturen access, omits them entirely otherwise", () => {
    const withCols = materialsExportColumns(withMoney).map((c) => c.key);
    const withoutCols = materialsExportColumns(withoutMoney).map((c) => c.key);
    expect(withCols).toContain("dayPrice");
    expect(withCols).toContain("costPrice");
    expect(withoutCols).not.toContain("dayPrice");
    expect(withoutCols).not.toContain("costPrice");
  });

  it("real numbers, not Decimal-as-string, for a booked money field", async () => {
    const rows = await fetchMaterialsExportRows(false, client);
    const tent = rows.find((r) => r.name === "Tent 4x8")!;
    expect(typeof tent.dayPrice).toBe("number");
    expect(tent.dayPrice).toBe(45);
  });
});

describe("people export (P2.2)", () => {
  it("carries function names as a comma-separated string, no legacy role column", async () => {
    const rows = await fetchPeopleExportRows(client);
    const alice = rows.find((r) => r.name === "Alice")!;
    expect(alice.functions).toBe("Electrician");
    expect(alice).not.toHaveProperty("role");
  });

  it("omits dayPrice for a caller without Kosten/Facturen access", () => {
    const cols = peopleExportColumns(withoutMoney).map((c) => c.key);
    expect(cols).not.toContain("dayPrice");
  });
});

describe("clients/locations export (P2.2)", () => {
  it("clients export carries no money column at all", async () => {
    const rows = await fetchClientsExportRows(client);
    const row = rows.find((r) => r.name === "Summer Sounds vzw");
    expect(row).toBeDefined();
    expect(row).not.toHaveProperty("dayPrice");
  });

  it("locations export carries no money column at all", async () => {
    const rows = await fetchLocationsExportRows(client);
    expect(rows.find((r) => r.name === "Gent")).toBeDefined();
  });
});
