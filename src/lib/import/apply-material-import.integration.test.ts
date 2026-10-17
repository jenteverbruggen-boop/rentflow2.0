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
import { materialAdapter } from "@/lib/import/adapters/material";
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

  it("E2: a new inhuur row lands as purchase price per rental, selling price 0", async () => {
    await applyMaterialImport([row({
      code: "9998-010", name: "Bord E2", categoryName: "Inhuur Funrent", categoryPrefix: "9998",
      dayPrice: 0, stockItems: [], subhireSupplierName: "Funrent", subhireUnitCost: 0.38,
    })], [], client);
    const m = await client.material.findUnique({ where: { code: "9998-010" } });
    expect(m).toMatchObject({ dayPrice: 0, subhireUnitCost: 0.38, subhireCostBasis: "per_huur", priceBasis: "per_huur", subhireOnly: true });
  });

  it("E2: a re-import never overwrites an entered selling price or purchase price, and fills an empty purchase price", async () => {
    const inhuur = (cost: number | null) => row({
      code: "9998-011", name: "Tafel E2", categoryName: "Inhuur Funrent", categoryPrefix: "9998",
      dayPrice: 0, stockItems: [], subhireSupplierName: "Funrent", subhireUnitCost: cost,
    });
    await applyMaterialImport([inhuur(null)], [], client);
    await client.material.update({ where: { code: "9998-011" }, data: { dayPrice: 7.5 } });
    // Empty purchase price gets filled; the selling price stays.
    expect(await applyMaterialImport([inhuur(2)], [], client)).toMatchObject({ updated: 1 });
    expect(await client.material.findUnique({ where: { code: "9998-011" } })).toMatchObject({ dayPrice: 7.5, subhireUnitCost: 2 });
    // A different price in the file is ignored now that one is set.
    expect(await applyMaterialImport([inhuur(9)], [], client)).toMatchObject({ unchanged: 1 });
    expect(await client.material.findUnique({ where: { code: "9998-011" } })).toMatchObject({ dayPrice: 7.5, subhireUnitCost: 2 });
  });

  it("an existing material with own units stays normal: default supplier set, purchase price filled only when empty, prices untouched", async () => {
    const base = { code: "0888-020", name: "Kruk", categoryName: "Zitmeubilair", categoryPrefix: "0888" };
    await applyMaterialImport([row({ ...base, dayPrice: 4 })], [], client);
    const inhuur = (cost: number) => row({ ...base, dayPrice: 0, stockItems: [], subhireSupplierName: "Rent-men", subhireUnitCost: cost });
    const result = await applyMaterialImport([inhuur(1.5)], [], client);
    expect(result).toMatchObject({ updated: 1, errors: [] });
    const m = await client.material.findUniqueOrThrow({ where: { code: "0888-020" }, include: { defaultSupplier: true, stockItems: true } });
    expect(m).toMatchObject({ subhireOnly: false, dayPrice: 4, priceBasis: "per_dag", subhireUnitCost: 1.5 });
    expect(m.defaultSupplier?.name).toBe("Rent-men");
    expect(m.stockItems).toHaveLength(2);
    // A different price in the file no longer changes anything.
    expect(await applyMaterialImport([inhuur(9)], [], client)).toMatchObject({ unchanged: 1 });
    expect((await client.material.findUniqueOrThrow({ where: { code: "0888-020" } })).subhireUnitCost).toBe(1.5);
  });

  it("a new inhuur row with units becomes a normal material with stock, supplier and purchase price", async () => {
    const result = await applyMaterialImport([row({
      code: "0888-030", name: "Bierbank", categoryName: "Zitmeubilair", categoryPrefix: "0888",
      dayPrice: 0, subhireSupplierName: "Rent-men", subhireUnitCost: 2.5,
    })], [], client);
    expect(result).toMatchObject({ created: 1, errors: [] });
    const m = await client.material.findUniqueOrThrow({ where: { code: "0888-030" }, include: { stockItems: true, defaultSupplier: true } });
    expect(m).toMatchObject({ subhireOnly: false, dayPrice: 0, priceBasis: "per_dag", subhireUnitCost: 2.5 });
    expect(m.stockItems).toHaveLength(2);
    expect(m.defaultSupplier?.name).toBe("Rent-men");
  });

  it("preview agrees with apply for an inhuur row onto a material with units", async () => {
    const base = { code: "0888-021", name: "Bank", categoryName: "Zitmeubilair", categoryPrefix: "0888" };
    await applyMaterialImport([row({ ...base, dayPrice: 3 })], [], client);
    const inhuur = row({ ...base, dayPrice: 0, stockItems: [], subhireSupplierName: "Rent-men", subhireUnitCost: 1 });
    const diff = async () => materialAdapter.diffAgainstExisting(inhuur, (await materialAdapter.fetchExisting(client, ["0888-021"])).get("0888-021") as ParsedMaterialRow);
    expect(await diff()).toMatchObject({ classification: "updated" });
    expect(await applyMaterialImport([inhuur], [], client)).toMatchObject({ updated: 1, errors: [] });
    expect(await diff()).toMatchObject({ classification: "unchanged" });
    expect(await applyMaterialImport([inhuur], [], client)).toMatchObject({ unchanged: 1 });
  });
});
