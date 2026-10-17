import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

vi.stubEnv("DATABASE_URL", `file:/tmp/release-init.db`);
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { execSync } from "child_process";
import os from "os";
import path from "path";
import fs from "fs";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "@/generated/prisma/client";
import { prisma as mockedPrisma } from "@/lib/prisma";
import { bookFlatMaterial, freeStockItemIds } from "@/lib/booking";
import { bookBundleMaterial } from "@/lib/bundle-booking";
import { releaseProjectStock } from "@/lib/release-cancelled-stock";
import { buildInvoiceDraft } from "@/lib/build-invoice-draft";

const DB_PATH = path.join(os.tmpdir(), `release-${process.pid}.db`);
const DB_URL = `file:${DB_PATH}`;

let client: PrismaClient;
let supplierId: number;
let flatId: number;
let chairId: number;
let setId: number;

beforeAll(async () => {
  execSync(`DATABASE_URL=${DB_URL} npx prisma db push --schema=prisma/schema.dev.prisma`, { stdio: "pipe" });
  client = new PrismaClient({ adapter: new PrismaLibSql({ url: DB_URL }) } as never);
  Object.assign(mockedPrisma as object, client);
  supplierId = (await client.supplier.create({ data: { name: "Funrent" } })).id;
  flatId = (await client.material.create({ data: { name: "Tafel", dayPrice: 10 } })).id;
  chairId = (await client.material.create({ data: { name: "Stoel", dayPrice: 2 } })).id;
  for (const materialId of [flatId, chairId]) {
    await client.stockItem.createMany({ data: [1, 2, 3, 4].map((unitNumber) => ({ materialId, unitNumber })) });
  }
  setId = (await client.material.create({ data: { name: "Set", isBundle: true } })).id;
  await client.materialComponent.create({ data: { parentId: setId, childId: chairId, quantity: 2 } });
}, 60_000);

afterAll(async () => {
  await client.$disconnect();
  fs.rmSync(DB_PATH, { force: true });
});

const from = new Date("2026-06-01");
const to = new Date("2026-06-03");

async function project(status = "bevestigd") {
  const c = await client.client.create({ data: { name: `K ${Math.random()}` } });
  const p = await client.project.create({
    data: { name: `P ${Math.random()}`, clientId: c.id, status, startDate: from, endDate: to,
      periods: { create: [{ name: "E", startDate: from, endDate: to }] } },
    include: { periods: true },
  });
  return { projectId: p.id, periodId: p.periods[0].id };
}

const release = (projectId: number) =>
  client.$transaction((tx) => releaseProjectStock(projectId, tx as unknown as PrismaClient));

describe("releaseProjectStock (B1)", () => {
  it("turns owned flat and set units into open rows with equal prices; invoice lines stay identical", async () => {
    const { projectId, periodId } = await project();
    await bookFlatMaterial({ periodId, materialId: flatId, quantity: 2, from, to, dayPriceSnapshot: 10, setupCostSnapshot: 5, discountPct: 10, client });
    await bookBundleMaterial({
      periodId, materialId: setId, quantity: 1, from, to, dayPriceSnapshot: 6,
      components: [{ childId: chairId, quantity: 2, dayPrice: 2 }], client,
    });
    const hiredSource = await client.periodMaterialShortage.create({
      data: { periodId, materialId: flatId, quantity: 3, dayPriceSnapshot: 10, supplierId, subhireUnitCost: 1, subhireCostBasis: "per_huur" },
    });
    const before = await buildInvoiceDraft({ projectId, invoiceRole: "standalone" }, client);

    const summary = await release(projectId);
    expect(summary.released).toBe(4);
    expect(summary.keptShipped).toEqual([]);
    expect(summary.hired).toEqual([{ supplier: "Funrent", material: "Tafel", period: "E", quantity: 3 }]);

    expect(await client.periodStockItem.count({ where: { periodId } })).toBe(0);
    const open = await client.periodMaterialShortage.findMany({ where: { periodId, supplierId: null }, orderBy: { materialId: "asc" } });
    expect(open).toHaveLength(2);
    expect(open[0]).toMatchObject({ materialId: flatId, quantity: 2, dayPriceSnapshot: 10, setupCostSnapshot: 5, discountPct: 10, bundleBookingId: null });
    expect(open[1]).toMatchObject({ materialId: chairId, quantity: 2, dayPriceSnapshot: 0 });
    expect(open[1].bundleBookingId).not.toBeNull();
    expect(await client.periodMaterialShortage.findUnique({ where: { id: hiredSource.id } })).toMatchObject({ quantity: 3, supplierId });
    expect(await client.periodBundleBooking.count({ where: { periodId } })).toBe(1);

    const after = await buildInvoiceDraft({ projectId, invoiceRole: "standalone" }, client);
    // Same lines; groups with an equal material name may swap places.
    const canon = (ls?: { sortOrder: number }[]) =>
      (ls ?? []).map((l) => JSON.stringify({ ...l, sortOrder: 0 })).sort();
    expect(canon(after?.lines)).toEqual(canon(before?.lines));
    expect(after?.totals).toEqual(before?.totals);
  });

  it("keeps groups that differ only in setup cost separate", async () => {
    const { projectId, periodId } = await project();
    await bookFlatMaterial({ periodId, materialId: chairId, quantity: 1, from, to, dayPriceSnapshot: 2, setupCostSnapshot: 0, client });
    await bookFlatMaterial({ periodId, materialId: chairId, quantity: 1, from, to, dayPriceSnapshot: 2, setupCostSnapshot: 5, client });
    await release(projectId);
    const rows = await client.periodMaterialShortage.findMany({ where: { periodId, materialId: chairId }, orderBy: { setupCostSnapshot: "asc" } });
    expect(rows.map((r) => [r.quantity, Number(r.setupCostSnapshot)])).toEqual([[1, 0], [1, 5]]);
  });

  it("frees the stock for another project at once", async () => {
    const { projectId, periodId } = await project();
    await bookFlatMaterial({ periodId, materialId: flatId, quantity: 4, from, to, dayPriceSnapshot: 10, setupCostSnapshot: 0, client });
    expect(await client.$transaction((tx) => freeStockItemIds(tx as unknown as PrismaClient, flatId, from, to))).toHaveLength(0);
    await release(projectId);
    expect(await client.$transaction((tx) => freeStockItemIds(tx as unknown as PrismaClient, flatId, from, to))).toHaveLength(4);
  });

  it("keeps a shipped, not returned unit", async () => {
    const { projectId, periodId } = await project();
    await bookFlatMaterial({ periodId, materialId: flatId, quantity: 2, from, to, dayPriceSnapshot: 10, setupCostSnapshot: 0, client });
    const units = await client.periodStockItem.findMany({ where: { periodId } });
    await client.periodStockItem.update({ where: { id: units[0].id }, data: { shippedAt: new Date() } });
    const summary = await release(projectId);
    expect(summary).toMatchObject({ released: 1, keptShipped: [{ material: "Tafel", quantity: 1, period: "E" }] });
    expect(await client.periodStockItem.count({ where: { periodId } })).toBe(1);
    expect(await client.periodMaterialShortage.aggregate({ where: { periodId }, _sum: { quantity: true } })).toMatchObject({ _sum: { quantity: 1 } });
  });
});
