import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

vi.stubEnv("DATABASE_URL", `file:/tmp/booking-integration-init.db`);
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { execSync } from "child_process";
import os from "os";
import path from "path";
import fs from "fs";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "@/generated/prisma/client";
import { bookFlatMaterial, bookBundleMaterial, freeStockItemIds } from "@/lib/booking";
import { bundleAvailableCount } from "@/lib/availability";

const DB_PATH = path.join(os.tmpdir(), `booking-integration-${process.pid}.db`);
const DB_URL = `file:${DB_PATH}`;

let client: PrismaClient;

const T1 = { start: new Date("2026-08-01T09:00:00Z"), end: new Date("2026-08-03T17:00:00Z") };
const T2 = { start: new Date("2026-08-02T09:00:00Z"), end: new Date("2026-08-04T17:00:00Z") };
const T3 = { start: new Date("2026-08-03T17:00:00Z"), end: new Date("2026-08-05T09:00:00Z") };

const ids = {
  project: 0,
  periodT1: 0,
  periodT2: 0,
  periodT3: 0,
  table: 0,
  blackCover: 0,
  whiteCover: 0,
  setBlack: 0,
  setWhite: 0,
};

beforeAll(async () => {
  execSync(
    `DATABASE_URL=${DB_URL} npx prisma db push --schema=prisma/schema.dev.prisma`,
    { stdio: "pipe" },
  );

  const adapter = new PrismaLibSql({ url: DB_URL });
  client = new PrismaClient({ adapter } as never);

  const project = await client.project.create({
    data: { name: "Test Project", startDate: new Date("2026-08-01"), endDate: new Date("2026-08-10") },
  });
  ids.project = project.id;

  const periodT1 = await client.period.create({
    data: { projectId: project.id, name: "T1", startDate: T1.start, endDate: T1.end },
  });
  ids.periodT1 = periodT1.id;

  const periodT2 = await client.period.create({
    data: { projectId: project.id, name: "T2", startDate: T2.start, endDate: T2.end },
  });
  ids.periodT2 = periodT2.id;

  const periodT3 = await client.period.create({
    data: { projectId: project.id, name: "T3 (back-to-back after T1)", startDate: T3.start, endDate: T3.end },
  });
  ids.periodT3 = periodT3.id;

  const table = await client.material.create({ data: { name: "Cocktailtafel", dayPrice: 5, isBundle: false } });
  ids.table = table.id;
  await client.stockItem.createMany({
    data: Array.from({ length: 10 }, (_, i) => ({ materialId: table.id, unitNumber: i + 1 })),
  });

  const blackCover = await client.material.create({ data: { name: "Zwarte hoes", dayPrice: 2, isBundle: false } });
  ids.blackCover = blackCover.id;
  await client.stockItem.createMany({
    data: Array.from({ length: 5 }, (_, i) => ({ materialId: blackCover.id, unitNumber: i + 1 })),
  });

  const whiteCover = await client.material.create({ data: { name: "Witte hoes", dayPrice: 2, isBundle: false } });
  ids.whiteCover = whiteCover.id;
  await client.stockItem.createMany({
    data: Array.from({ length: 5 }, (_, i) => ({ materialId: whiteCover.id, unitNumber: i + 1 })),
  });

  const setBlack = await client.material.create({ data: { name: "Set Zwart", dayPrice: 7, isBundle: true } });
  ids.setBlack = setBlack.id;
  await client.materialComponent.create({ data: { parentId: setBlack.id, childId: table.id, quantity: 1 } });
  await client.materialComponent.create({ data: { parentId: setBlack.id, childId: blackCover.id, quantity: 1 } });

  const setWhite = await client.material.create({ data: { name: "Set Wit", dayPrice: 7, isBundle: true } });
  ids.setWhite = setWhite.id;
  await client.materialComponent.create({ data: { parentId: setWhite.id, childId: table.id, quantity: 1 } });
  await client.materialComponent.create({ data: { parentId: setWhite.id, childId: whiteCover.id, quantity: 1 } });
}, 60_000);

afterAll(async () => {
  await client.$disconnect();
  fs.rmSync(DB_PATH, { force: true });
});

async function bookBlack(qty: number, periodId: number) {
  return bookBundleMaterial({
    periodId,
    materialId: ids.setBlack,
    quantity: qty,
    from: T1.start,
    to: T1.end,
    dayPriceSnapshot: 7,
    components: [
      { childId: ids.table, quantity: 1 },
      { childId: ids.blackCover, quantity: 1 },
    ],
    client,
  });
}

async function bookWhite(qty: number, periodId: number) {
  return bookBundleMaterial({
    periodId,
    materialId: ids.setWhite,
    quantity: qty,
    from: T1.start,
    to: T1.end,
    dayPriceSnapshot: 7,
    components: [
      { childId: ids.table, quantity: 1 },
      { childId: ids.whiteCover, quantity: 1 },
    ],
    client,
  });
}

describe("booking integration — shared component stock", () => {
  it("bundleAvailableCount: both sets see full 10 tables initially", async () => {
    const cntBlack = await bundleAvailableCount(ids.setBlack, { from: T1.start, to: T1.end }, client);
    const cntWhite = await bundleAvailableCount(ids.setWhite, { from: T1.start, to: T1.end }, client);
    expect(cntBlack).toBe(5);
    expect(cntWhite).toBe(5);
  });

  it("clean match: book 5 black sets + 5 white sets — all succeed, 10 tables consumed", async () => {
    const b1 = await bookBlack(5, ids.periodT1);
    expect(b1.bundleBooking).toBeTruthy();

    const freeAfterBlack = await freeStockItemIds(client, ids.table, T1.start, T1.end);
    expect(freeAfterBlack).toHaveLength(5);

    const b2 = await bookWhite(5, ids.periodT2);
    expect(b2.bundleBooking).toBeTruthy();

    const freeAfterAll = await freeStockItemIds(client, ids.table, T1.start, T1.end);
    expect(freeAfterAll).toHaveLength(0);

    const assignments = await client.periodStockItem.findMany({ where: { stockItem: { materialId: ids.table } } });
    const uniqueStockItemIds = new Set(assignments.map((a) => a.stockItemId));
    expect(uniqueStockItemIds.size).toBe(10);
  });

  it("cross-set exhaustion: booking more than remaining tables fails with UNAVAIL", async () => {
    let err: Error & { code?: string } | null = null;
    try {
      await bookWhite(1, ids.periodT2);
    } catch (e) {
      err = e as Error & { code?: string };
    }
    expect(err?.code).toBe("UNAVAIL");
  });

  it("unbook: deleting a bundle booking frees shared tables for the other set", async () => {
    const bookings = await client.periodBundleBooking.findMany({ where: { materialId: ids.setBlack } });
    for (const b of bookings) {
      await client.periodStockItem.deleteMany({ where: { bundleBookingId: b.id } });
      await client.periodBundleBooking.delete({ where: { id: b.id } });
    }
    const freed = await freeStockItemIds(client, ids.table, T1.start, T1.end);
    expect(freed).toHaveLength(5);
  });

  it("back-to-back boundary: end of T1 == start of T3 → no conflict", async () => {
    const freeInT3 = await freeStockItemIds(client, ids.table, T3.start, T3.end);
    expect(freeInT3).toHaveLength(5);
  });

  it("flat booking reduces bundle availability for shared set", async () => {
    const flatBefore = await freeStockItemIds(client, ids.table, T1.start, T1.end);
    const flatCount = flatBefore.length;

    await bookFlatMaterial({
      periodId: ids.periodT1,
      materialId: ids.table,
      quantity: 2,
      from: T1.start,
      to: T1.end,
      dayPriceSnapshot: 5,
      setupCostSnapshot: 0,
      client,
    });

    const bundleAvail = await bundleAvailableCount(ids.setWhite, { from: T1.start, to: T1.end }, client);
    const flatAfter = await freeStockItemIds(client, ids.table, T1.start, T1.end);
    expect(flatAfter).toHaveLength(flatCount - 2);
    expect(bundleAvail).toBeLessThanOrEqual(flatAfter.length);
  });
});
