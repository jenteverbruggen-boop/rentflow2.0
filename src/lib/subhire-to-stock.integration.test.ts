import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

vi.stubEnv("DATABASE_URL", `file:/tmp/to-stock-init.db`);
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { execSync } from "child_process";
import os from "os";
import path from "path";
import fs from "fs";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "@/generated/prisma/client";
import { prisma as mockedPrisma } from "@/lib/prisma";
import { takeOwnStockForHire } from "@/lib/subhire-to-stock";
import { fillShortages } from "@/lib/material-shortage-db";

const DB_PATH = path.join(os.tmpdir(), `to-stock-${process.pid}.db`);
const DB_URL = `file:${DB_PATH}`;

let client: PrismaClient;
let supplierId: number;

beforeAll(async () => {
  execSync(`DATABASE_URL=${DB_URL} npx prisma db push --schema=prisma/schema.dev.prisma`, { stdio: "pipe" });
  client = new PrismaClient({ adapter: new PrismaLibSql({ url: DB_URL }) } as never);
  Object.assign(mockedPrisma as object, client);
  supplierId = (await client.supplier.create({ data: { name: "Funrent" } })).id;
}, 60_000);

afterAll(async () => {
  await client.$disconnect();
  fs.rmSync(DB_PATH, { force: true });
});

const from = new Date("2026-06-01");
const to = new Date("2026-06-03");

async function project(name: string, status = "concept") {
  const c = await client.client.create({ data: { name: `K ${Math.random()}` } });
  const p = await client.project.create({
    data: { name, clientId: c.id, status, startDate: from, endDate: to, periods: { create: [{ name: "E", startDate: from, endDate: to }] } },
    include: { periods: true },
  });
  return { projectId: p.id, periodId: p.periods[0].id };
}

async function hiredRow(qty: number, stockFree: boolean) {
  const p = await project(`P ${Math.random()}`, "bevestigd");
  const m = await client.material.create({ data: { name: `M ${Math.random()}`, dayPrice: 10 } });
  if (stockFree) await client.stockItem.createMany({ data: [1, 2].map((unitNumber) => ({ materialId: m.id, unitNumber })) });
  const row = await client.periodMaterialShortage.create({
    data: { periodId: p.periodId, materialId: m.id, quantity: qty, dayPriceSnapshot: 10, setupCostSnapshot: 3, discountPct: 5, supplierId, subhireUnitCost: 1 },
  });
  return { ...p, row, materialId: m.id };
}

describe("takeOwnStockForHire (C3)", () => {
  it("converts partially: owned units copy the price, the hired row shrinks", async () => {
    const { periodId, row, materialId: mid } = await hiredRow(5, true);
    const result = await takeOwnStockForHire(periodId, row.id, 5, client);
    expect(result).toEqual({ converted: 2, supplierName: "Funrent" });
    const units = await client.periodStockItem.findMany({ where: { periodId, stockItem: { materialId: mid } } });
    expect(units).toHaveLength(2);
    expect(units[0]).toMatchObject({ dayPriceSnapshot: 10, setupCostSnapshot: 3, discountPct: 5 });
    expect((await client.periodMaterialShortage.findUnique({ where: { id: row.id } }))?.quantity).toBe(3);
  });

  it("deletes the row when everything converts", async () => {
    const { periodId, row } = await hiredRow(2, true);
    await takeOwnStockForHire(periodId, row.id, 2, client);
    expect(await client.periodMaterialShortage.findUnique({ where: { id: row.id } })).toBeNull();
  });

  it("refuses an open row and refuses when nothing is free", async () => {
    const open = await hiredRow(2, true);
    await client.periodMaterialShortage.update({ where: { id: open.row.id }, data: { supplierId: null } });
    await expect(takeOwnStockForHire(open.periodId, open.row.id, 1, client)).rejects.toMatchObject({ code: "NOT_SUBHIRED" });
    const none = await hiredRow(2, false);
    await expect(takeOwnStockForHire(none.periodId, none.row.id, 1, client)).rejects.toMatchObject({ code: "NOTHING_FREE" });
  });

  it("refuses a cancelled project", async () => {
    const { projectId, periodId, row } = await hiredRow(2, true);
    await client.project.update({ where: { id: projectId }, data: { status: "geannuleerd" } });
    await expect(takeOwnStockForHire(periodId, row.id, 1, client)).rejects.toMatchObject({ code: "PROJECT_LOCKED" });
  });

  it("is never triggered by fillShortages", async () => {
    const { projectId, periodId, row } = await hiredRow(2, true);
    await fillShortages(projectId, client);
    expect(await client.periodMaterialShortage.findUnique({ where: { id: row.id } })).toMatchObject({ quantity: 2, supplierId });
    expect(await client.periodStockItem.count({ where: { periodId } })).toBe(0);
  });
});
