import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

vi.stubEnv("DATABASE_URL", `file:/tmp/material-import-real-files-init.db`);
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { execSync } from "child_process";
import os from "os";
import path from "path";
import fs from "fs";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "@/generated/prisma/client";
import { parseCsv } from "@/lib/csv-parser";
import { detectFormat } from "@/lib/import/format-detection";
import { parseMaterialRows } from "@/lib/import/material-adapter";
import { applyMaterialImport } from "@/lib/import/apply-material-import";

const DB_PATH = path.join(os.tmpdir(), `material-import-real-files-${process.pid}.db`);
const DB_URL = `file:${DB_PATH}`;
const TOOLS_DIR = path.join(process.cwd(), ".plans", "tools");

let client: PrismaClient;

function loadRows(filename: string) {
  const content = fs.readFileSync(path.join(TOOLS_DIR, filename), "utf8");
  return parseCsv(content);
}

async function importFile(filename: string) {
  const rows = loadRows(filename);
  const format = detectFormat(Object.keys(rows[0]));
  const { materials, errors } = parseMaterialRows(rows, format);
  return applyMaterialImport(materials, errors, client);
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

/**
 * M1.6 — imports the two real Rentman exports (`.plans/tools/`) into a
 * real SQLite DB through the exact same pipeline the API routes use
 * (parse → detect → adapt → apply), verifying the exact figures the
 * phase-2 brief re-derived independently from the raw CSVs.
 */
describe("M1.6 — real export files, end to end", () => {
  it("imports the normal file: 103 materials, 11 categories, the 9998-902 collision reported without failing the rest", async () => {
    const result = await importFile("Export_Equipment_normal.csv");

    expect(result.created).toBe(103);
    expect(result.updated).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].reason).toContain("9998-902");

    const materialCount = await client.material.count();
    const categoryCount = await client.category.count();
    expect(materialCount).toBe(103);
    expect(categoryCount).toBe(11);

    const kept = await client.material.findUnique({ where: { code: "9998-902" } });
    expect(kept?.name).toBe("Vorken (vis)");
    const lost = await client.material.findFirst({ where: { name: "Messen (Vis)" } });
    expect(lost).toBeNull();

    const stockItemCount = await client.stockItem.count();
    expect(stockItemCount).toBe(1631);
  });

  it("re-importing the normal file is idempotent — no duplicate materials or categories", async () => {
    const result = await importFile("Export_Equipment_normal.csv");

    expect(result.created).toBe(0);
    expect(result.errors).toHaveLength(1);

    const materialCount = await client.material.count();
    const categoryCount = await client.category.count();
    expect(materialCount).toBe(103);
    expect(categoryCount).toBe(11);
  });

  it("imports the advanced file: 287 archived materials, hidden from the default list and availability", async () => {
    const result = await importFile("Export_Equipment_advanced.csv");
    expect(result.created).toBe(287);
    expect(result.errors).toHaveLength(0);

    const archivedCount = await client.material.count({ where: { archived: true } });
    expect(archivedCount).toBe(287);

    // Mirrors materials/route.ts's default filter and
    // materials/available/route.ts's unconditional one (M1.3).
    const visibleInList = await client.material.count({ where: { archived: false } });
    const visibleForBooking = await client.material.count({ where: { archived: false } });
    expect(visibleInList).toBe(103);
    expect(visibleForBooking).toBe(103);
  });

  it("re-importing both files together is idempotent — total counts unchanged", async () => {
    const normal = await importFile("Export_Equipment_normal.csv");
    const advanced = await importFile("Export_Equipment_advanced.csv");

    expect(normal.created).toBe(0);
    expect(advanced.created).toBe(0);

    const materialCount = await client.material.count();
    const categoryCount = await client.category.count();
    expect(materialCount).toBe(103 + 287);
    expect(categoryCount).toBe(11);
  });
});
