import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

vi.stubEnv("DATABASE_URL", `file:/tmp/compute-payback-init.db`);
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { execSync } from "child_process";
import os from "os";
import path from "path";
import fs from "fs";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "@/generated/prisma/client";
import { computePaybackStats } from "@/lib/compute-payback";

const DB_PATH = path.join(os.tmpdir(), `compute-payback-${process.pid}.db`);
const DB_URL = `file:${DB_PATH}`;

let client: PrismaClient;
const ids = { table: 0, cover: 0, fridge: 0, archived: 0 };

beforeAll(async () => {
  execSync(`DATABASE_URL=${DB_URL} npx prisma db push --schema=prisma/schema.dev.prisma`, { stdio: "pipe" });
  const adapter = new PrismaLibSql({ url: DB_URL });
  client = new PrismaClient({ adapter } as never);

  const clientRow = await client.client.create({ data: { name: "Payback Test Client" } });
  const project = await client.project.create({
    data: { name: "Payback Test Project", clientId: clientRow.id, startDate: new Date("2026-06-01"), endDate: new Date("2026-06-01") },
  });
  const period = await client.period.create({
    data: { projectId: project.id, name: "Event", startDate: new Date("2026-06-01"), endDate: new Date("2026-06-01") },
  });

  // Cocktailtafel (€50 cost, one unit, rented only inside the set) +
  // hoes — the exact Q48 scenario, end to end through a real booking.
  const table = await client.material.create({ data: { name: "Cocktailtafel", dayPrice: 5, costPrice: 50 } });
  const cover = await client.material.create({ data: { name: "Cocktailtafelhoes", dayPrice: 3, costPrice: 20 } });
  ids.table = table.id;
  ids.cover = cover.id;
  const tableStock = await client.stockItem.create({ data: { materialId: table.id, unitNumber: 1 } });
  const coverStock = await client.stockItem.create({ data: { materialId: cover.id, unitNumber: 1 } });

  const bundleBooking = await client.periodBundleBooking.create({
    data: { periodId: period.id, materialId: table.id, quantity: 1, dayPriceSnapshot: 8 },
  });
  await client.periodBundleBookingComponent.createMany({
    data: [
      { bundleBookingId: bundleBooking.id, materialId: table.id, quantity: 1, dayPriceAtBooking: 5 },
      { bundleBookingId: bundleBooking.id, materialId: cover.id, quantity: 1, dayPriceAtBooking: 3 },
    ],
  });
  await client.periodStockItem.createMany({
    data: [
      { periodId: period.id, stockItemId: tableStock.id, dayPriceSnapshot: 0, bundleBookingId: bundleBooking.id },
      { periodId: period.id, stockItemId: coverStock.id, dayPriceSnapshot: 0, bundleBookingId: bundleBooking.id },
    ],
  });

  // A fridge, flat-booked, no bundle involvement — the brief's own
  // 300 + 330 = 110% example.
  const fridge = await client.material.create({ data: { name: "Frigo", dayPrice: 330, costPrice: 300 } });
  ids.fridge = fridge.id;
  const fridgeStock = await client.stockItem.create({ data: { materialId: fridge.id, unitNumber: 1 } });
  await client.periodStockItem.create({
    data: { periodId: period.id, stockItemId: fridgeStock.id, dayPriceSnapshot: 330, setupCostSnapshot: 0 },
  });

  // An archived material with tracked cost — must never appear.
  const archived = await client.material.create({ data: { name: "Oude flightcase", dayPrice: 10, costPrice: 500, archived: true } });
  ids.archived = archived.id;
}, 60_000);

afterAll(async () => {
  await client.$disconnect();
  fs.rmSync(DB_PATH, { force: true });
});

describe("computePaybackStats (K4.2 — real seeded data)", () => {
  it("the cocktailtafel case: a component rented only inside a set shows its pro-rata share, not €0", async () => {
    const { best } = await computePaybackStats(client);
    const table = best.find((r) => r.materialId === ids.table);
    expect(table?.earned).toBe(5); // 8 * 5/8
  });

  it("reproduces the brief's own 300 + 330 = 110% example", async () => {
    const { best } = await computePaybackStats(client);
    const fridge = best.find((r) => r.materialId === ids.fridge);
    expect(fridge?.earned).toBe(330);
    expect(fridge?.costBasis).toBe(300);
    expect(fridge?.paybackPct).toBe(110);
  });

  it("never lists the archived material", async () => {
    const { best, worst } = await computePaybackStats(client);
    expect(best.find((r) => r.materialId === ids.archived)).toBeUndefined();
    expect(worst.find((r) => r.materialId === ids.archived)).toBeUndefined();
  });
});
