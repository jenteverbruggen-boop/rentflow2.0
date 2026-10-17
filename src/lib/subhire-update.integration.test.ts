import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

vi.stubEnv("DATABASE_URL", `file:/tmp/subhire-update-init.db`);
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { execSync } from "child_process";
import os from "os";
import path from "path";
import fs from "fs";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "@/generated/prisma/client";
import { prisma as mockedPrisma } from "@/lib/prisma";
import { subhireShortage } from "@/lib/subhire";
import { updateSubhire } from "@/lib/subhire-update";
import { toNumber } from "@/lib/serialize";

const DB_PATH = path.join(os.tmpdir(), `subhire-update-${process.pid}.db`);
const DB_URL = `file:${DB_PATH}`;

let client: PrismaClient;
let supplierId: number;
let materialId: number;

beforeAll(async () => {
  execSync(`DATABASE_URL=${DB_URL} npx prisma db push --schema=prisma/schema.dev.prisma`, { stdio: "pipe" });
  client = new PrismaClient({ adapter: new PrismaLibSql({ url: DB_URL }) } as never);
  Object.assign(mockedPrisma as object, client);
  supplierId = (await client.supplier.create({ data: { name: "Funrent" } })).id;
  materialId = (await client.material.create({ data: { name: "Bord", dayPrice: 1, defaultSupplierId: supplierId } })).id;
}, 60_000);

afterAll(async () => {
  await client.$disconnect();
  fs.rmSync(DB_PATH, { force: true });
});

async function setup(status: string, qty = 4, hire = true) {
  const clientRow = await client.client.create({ data: { name: `K ${Math.random()}` } });
  const project = await client.project.create({
    data: {
      name: `P ${Math.random()}`, clientId: clientRow.id, status,
      startDate: new Date("2026-06-01"), endDate: new Date("2026-06-03"),
      periods: { create: [{ name: "Event", startDate: new Date("2026-06-01"), endDate: new Date("2026-06-03") }] },
    },
    include: { periods: true },
  });
  const periodId = project.periods[0].id;
  const row = await client.periodMaterialShortage.create({ data: { periodId, materialId, quantity: qty, dayPriceSnapshot: 1 } });
  if (hire) await subhireShortage(periodId, row.id, { supplierId }, client);
  return { periodId, rowId: row.id };
}

describe("updateSubhire supplier change (A3)", () => {
  it("a price-only edit works for a since-archived supplier", async () => {
    const { periodId, rowId } = await setup("bevestigd");
    await client.supplier.update({ where: { id: supplierId }, data: { archived: true } });
    const row = await updateSubhire(periodId, rowId, { supplierId, unitCost: 2 }, client);
    expect(toNumber(row.subhireUnitCost)).toBe(2);
    await client.supplier.update({ where: { id: supplierId }, data: { archived: false } });
  });

  it("switching to a non-default supplier nulls the price and the fixed total", async () => {
    const { periodId, rowId } = await setup("concept");
    await client.periodMaterialShortage.update({ where: { id: rowId }, data: { subhireUnitCost: 5, subhireCostOverride: 99 } });
    const other = (await client.supplier.create({ data: { name: "Andere" } })).id;
    const row = await updateSubhire(periodId, rowId, { supplierId: other }, client);
    expect(row.supplierId).toBe(other);
    expect(row.subhireUnitCost).toBeNull();
    expect(row.subhireCostOverride).toBeNull();
  });

  it("switching to the default supplier takes the material's price", async () => {
    const { periodId, rowId } = await setup("concept");
    await client.material.update({ where: { id: materialId }, data: { subhireUnitCost: 1.25, subhireCostBasis: "per_dag" } });
    const other = (await client.supplier.create({ data: { name: "Tussen" } })).id;
    await updateSubhire(periodId, rowId, { supplierId: other }, client);
    const row = await updateSubhire(periodId, rowId, { supplierId }, client);
    expect(toNumber(row.subhireUnitCost)).toBe(1.25);
    expect(row.subhireCostBasis).toBe("per_dag");
  });

  it("refuses switching to an archived supplier", async () => {
    const { periodId, rowId } = await setup("concept");
    const old = (await client.supplier.create({ data: { name: "Oud", archived: true } })).id;
    await expect(updateSubhire(periodId, rowId, { supplierId: old }, client)).rejects.toMatchObject({ code: "BAD_SUPPLIER" });
  });
});
