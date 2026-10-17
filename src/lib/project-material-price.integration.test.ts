import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

vi.stubEnv("DATABASE_URL", `file:/tmp/pmp-init.db`);
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { execSync } from "child_process";
import os from "os";
import path from "path";
import fs from "fs";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "@/generated/prisma/client";
import { prisma as mockedPrisma } from "@/lib/prisma";
import { setProjectMaterialPrice, clearProjectMaterialPrice } from "@/lib/project-material-price";

const DB_PATH = path.join(os.tmpdir(), `pmp-${process.pid}.db`);
const DB_URL = `file:${DB_PATH}`;
let client: PrismaClient;

beforeAll(async () => {
  execSync(`DATABASE_URL=${DB_URL} npx prisma db push --schema=prisma/schema.dev.prisma`, { stdio: "pipe" });
  client = new PrismaClient({ adapter: new PrismaLibSql({ url: DB_URL }) } as never);
  Object.assign(mockedPrisma as object, client);
}, 60_000);

afterAll(async () => {
  await client.$disconnect();
  fs.rmSync(DB_PATH, { force: true });
});

describe("project material price override", () => {
  it("reprices stock, open and hired shortages but never set components", async () => {
    const supplier = await client.supplier.create({ data: { name: "Funrent" } });
    const material = await client.material.create({ data: { name: "Bank", code: "X-1", category: "X", dayPrice: 5 } });
    const stock = await client.stockItem.create({ data: { materialId: material.id, unitNumber: 1 } });
    const c = await client.client.create({ data: { name: "K" } });
    const d = new Date("2026-06-01");
    const project = await client.project.create({
      data: { name: "P", clientId: c.id, startDate: d, endDate: d, periods: { create: [{ name: "E", startDate: d, endDate: d }] } },
      include: { periods: true },
    });
    const periodId = project.periods[0].id;
    const setMat = await client.material.create({ data: { name: "Set", code: "X-2", category: "X", dayPrice: 9 } });
    const booking = await client.periodBundleBooking.create({ data: { periodId, materialId: setMat.id, dayPriceSnapshot: 9 } });
    const stock2 = await client.stockItem.create({ data: { materialId: material.id, unitNumber: 2 } });
    await client.periodStockItem.create({ data: { periodId, stockItemId: stock2.id, dayPriceSnapshot: 0, bundleBookingId: booking.id } });
    await client.periodMaterialShortage.create({ data: { periodId, materialId: material.id, quantity: 1, dayPriceSnapshot: 0, bundleBookingId: booking.id } });
    await client.periodStockItem.create({ data: { periodId, stockItemId: stock.id, dayPriceSnapshot: 5 } });
    await client.periodMaterialShortage.create({ data: { periodId, materialId: material.id, quantity: 1, dayPriceSnapshot: 5 } });
    await client.periodMaterialShortage.create({ data: { periodId, materialId: material.id, quantity: 2, dayPriceSnapshot: 5, supplierId: supplier.id, subhiredAt: new Date() } });

    await setProjectMaterialPrice(project.id, material.id, 3, client);
    const snap = async () => ({
      shortages: (await client.periodMaterialShortage.findMany({ where: { periodId, bundleBookingId: null }, orderBy: { id: "asc" } })).map((r) => r.dayPriceSnapshot),
      stock: (await client.periodStockItem.findFirstOrThrow({ where: { periodId, bundleBookingId: null } })).dayPriceSnapshot,
      compStock: (await client.periodStockItem.findFirstOrThrow({ where: { periodId, bundleBookingId: booking.id } })).dayPriceSnapshot,
      compShort: (await client.periodMaterialShortage.findFirstOrThrow({ where: { periodId, bundleBookingId: booking.id } })).dayPriceSnapshot,
    });
    expect(await snap()).toEqual({ shortages: [3, 3], stock: 3, compStock: 0, compShort: 0 });

    await clearProjectMaterialPrice(project.id, material.id, client);
    expect(await snap()).toEqual({ shortages: [5, 5], stock: 5, compStock: 0, compShort: 0 });
  });
});
