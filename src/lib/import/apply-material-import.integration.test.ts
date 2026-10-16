import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

vi.stubEnv("DATABASE_URL", `file:/tmp/apply-material-import-init.db`);
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { execSync } from "child_process";
import os from "os";
import path from "path";
import fs from "fs";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "@/generated/prisma/client";
import { applyMaterialImport } from "@/lib/import/apply-material-import";
import type { ParsedMaterialRow } from "@/lib/import/material-adapter";

const DB_PATH = path.join(os.tmpdir(), `apply-material-import-${process.pid}.db`);
const DB_URL = `file:${DB_PATH}`;

let client: PrismaClient;

function row(overrides: Partial<ParsedMaterialRow> = {}): ParsedMaterialRow {
  return {
    line: 2,
    externalId: "1",
    code: "0501-001",
    name: "Tent",
    categoryName: "Tenten",
    categoryPrefix: "0501",
    dayPrice: 95,
    costPrice: null,
    listPrice: null,
    isBundle: false,
    archived: false,
    notes: null,
    stockItems: [{ identifier: null, notes: null }, { identifier: null, notes: null }],
    ...overrides,
  };
}

beforeAll(async () => {
  execSync(`DATABASE_URL=${DB_URL} npx prisma db push --schema=prisma/schema.dev.prisma`, {
    stdio: "pipe",
  });
  const adapter = new PrismaLibSql({ url: DB_URL });
  client = new PrismaClient({ adapter } as never);
}, 60_000);

afterAll(async () => {
  await client.$disconnect();
  fs.rmSync(DB_PATH, { force: true });
});

describe("applyMaterialImport (M1.4)", () => {
  it("creates a new material, its category, and its stock items", async () => {
    const result = await applyMaterialImport([row()], [], client);
    expect(result).toEqual({ created: 1, updated: 0, unchanged: 0, errors: [] });

    const material = await client.material.findUnique({
      where: { code: "0501-001" },
      include: { stockItems: true, categoryRel: true },
    });
    expect(material?.name).toBe("Tent");
    expect(material?.categoryRel?.name).toBe("Tenten");
    expect(material?.categoryRel?.prefix).toBe("0501");
    expect(material?.stockItems.length).toBe(2);
  });

  it("re-importing the same row is idempotent — no duplicate material or category", async () => {
    const result = await applyMaterialImport([row()], [], client);
    expect(result).toEqual({ created: 0, updated: 0, unchanged: 1, errors: [] });

    const materials = await client.material.count({ where: { code: "0501-001" } });
    const categories = await client.category.count({ where: { name: "Tenten" } });
    expect(materials).toBe(1);
    expect(categories).toBe(1);
  });

  it("updates an existing material on a changed field, without touching its stock items", async () => {
    const before = await client.material.findUnique({
      where: { code: "0501-001" },
      include: { stockItems: true },
    });
    const result = await applyMaterialImport([row({ dayPrice: 120 })], [], client);
    expect(result).toEqual({ created: 0, updated: 1, unchanged: 0, errors: [] });

    const after = await client.material.findUnique({
      where: { code: "0501-001" },
      include: { stockItems: true },
    });
    expect(after?.dayPrice).toBe(120);
    expect(after?.stockItems.length).toBe(before?.stockItems.length);
  });

  it("a row whose code space is exhausted errors without aborting the rest of the file", async () => {
    const full = await client.category.create({ data: { name: "Volle categorie", prefix: "0777" } });
    await client.material.createMany({
      data: Array.from({ length: 999 }, (_, i) => ({
        name: `Vol ${i + 1}`,
        code: `0777-${String(i + 1).padStart(3, "0")}`,
        categoryId: full.id,
      })),
    });

    const exhausted = row({
      code: null,
      categoryName: "Volle categorie",
      categoryPrefix: "0777",
      name: "Geen code meer",
    });
    const stillGood = row({ code: "0501-003", name: "Kleine tent" });
    const result = await applyMaterialImport([exhausted, stillGood], [], client);

    expect(result.created).toBe(1);
    expect(result.errors).toEqual([
      { line: 2, reason: "Geen vrije code meer in deze categorie" },
    ]);
    const created = await client.material.findUnique({ where: { code: "0501-003" } });
    expect(created?.name).toBe("Kleine tent");
  });

  it("carries forward pre-existing parse errors untouched", async () => {
    const parseErrors = [{ line: 9, reason: "code 9998-902 is al gebruikt door ID 707" }];
    const result = await applyMaterialImport([], parseErrors, client);
    expect(result.errors).toEqual(parseErrors);
  });

  it("an 'Inhuur <leverancier>' folder makes the item inhuur-only, linked to a supplier created on first sight", async () => {
    const hired = row({
      code: "9998-001", name: "Bord (inhuur)", categoryName: "Inhuur Funrent", categoryPrefix: "9998",
      stockItems: [], subhireSupplierName: "Funrent",
    });
    const second = row({
      code: "9998-002", name: "Glas (inhuur)", categoryName: "Inhuur Funrent", categoryPrefix: "9998",
      stockItems: [], subhireSupplierName: "Funrent",
    });
    await applyMaterialImport([hired, second], [], client);

    const suppliers = await client.supplier.findMany({ where: { name: "Funrent" } });
    expect(suppliers).toHaveLength(1); // one supplier for both rows
    const material = await client.material.findUnique({ where: { code: "9998-001" }, include: { stockItems: true } });
    expect(material).toMatchObject({ subhireOnly: true, defaultSupplierId: suppliers[0].id });
    expect(material!.stockItems).toHaveLength(0);

    // Re-importing the same row changes nothing; an ordinary row is untouched.
    expect(await applyMaterialImport([hired], [], client)).toMatchObject({ unchanged: 1, updated: 0 });
    const ordinary = await client.material.findUnique({ where: { code: "0501-001" } });
    expect(ordinary?.subhireOnly ?? false).toBe(false);
  });

  it("an existing material turns inhuur-only when its row now sits in an Inhuur folder", async () => {
    await applyMaterialImport([row({ code: "0777-001", name: "Stoel", categoryName: "Meubilair", categoryPrefix: "0777" })], [], client);
    const result = await applyMaterialImport(
      [row({ code: "0777-001", name: "Stoel", categoryName: "Meubilair", categoryPrefix: "0777", subhireSupplierName: "Rent-men" })],
      [],
      client,
    );
    expect(result).toMatchObject({ updated: 1 });
    const supplier = await client.supplier.findFirstOrThrow({ where: { name: "Rent-men" } });
    expect(await client.material.findUnique({ where: { code: "0777-001" } })).toMatchObject({ subhireOnly: true, defaultSupplierId: supplier.id });
  });
});
