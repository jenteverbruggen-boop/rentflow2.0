import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

vi.stubEnv("DATABASE_URL", `file:/tmp/material-shortage-integration-init.db`);
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { execSync } from "child_process";
import os from "os";
import path from "path";
import fs from "fs";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "@/generated/prisma/client";
import { bookFlatMaterial } from "@/lib/booking";
import { bookBundleMaterial } from "@/lib/bundle-booking";
import {
  fillShortages,
  assertNoShortages,
} from "@/lib/material-shortage-db";
import { periodMaterialsCost, periodDays } from "@/lib/pricing";
import type { Period, PeriodBundleBooking, PeriodMaterialShortage } from "@/types";

const DB_PATH = path.join(os.tmpdir(), `material-shortage-integration-${process.pid}.db`);
const DB_URL = `file:${DB_PATH}`;

let client: PrismaClient;

const WINDOW = { start: new Date("2026-08-01T09:00:00Z"), end: new Date("2026-08-03T17:00:00Z") };

const ids = {
  project: 0,
  period: 0,
  glas: 0,
  kaars: 0,
  tafel: 0,
  stoel: 0,
  set: 0,
};

beforeAll(async () => {
  execSync(
    `DATABASE_URL=${DB_URL} npx prisma db push --schema=prisma/schema.dev.prisma`,
    { stdio: "pipe" },
  );

  const adapter = new PrismaLibSql({ url: DB_URL });
  client = new PrismaClient({ adapter } as never);

  const project = await client.project.create({
    data: { name: "Overboek Test", startDate: new Date("2026-08-01"), endDate: new Date("2026-08-10") },
  });
  ids.project = project.id;

  const period = await client.period.create({
    data: { projectId: project.id, name: "T1", startDate: WINDOW.start, endDate: WINDOW.end },
  });
  ids.period = period.id;

  const glas = await client.material.create({ data: { name: "Glas", dayPrice: 5, isBundle: false } });
  ids.glas = glas.id;
  await client.stockItem.createMany({
    data: Array.from({ length: 10 }, (_, i) => ({ materialId: glas.id, unitNumber: i + 1 })),
  });

  const kaars = await client.material.create({ data: { name: "Kaars", dayPrice: 2, isBundle: false } });
  ids.kaars = kaars.id;
  await client.stockItem.createMany({
    data: Array.from({ length: 10 }, (_, i) => ({ materialId: kaars.id, unitNumber: i + 1 })),
  });

  const tafel = await client.material.create({ data: { name: "Tafel", dayPrice: 5, isBundle: false } });
  ids.tafel = tafel.id;
  await client.stockItem.createMany({
    data: Array.from({ length: 5 }, (_, i) => ({ materialId: tafel.id, unitNumber: i + 1 })),
  });

  const stoel = await client.material.create({ data: { name: "Stoel", dayPrice: 3, isBundle: false } });
  ids.stoel = stoel.id;
  await client.stockItem.createMany({
    data: Array.from({ length: 2 }, (_, i) => ({ materialId: stoel.id, unitNumber: i + 1 })),
  });

  const set = await client.material.create({ data: { name: "Set", dayPrice: 8, isBundle: true } });
  ids.set = set.id;
  await client.materialComponent.create({ data: { parentId: set.id, childId: tafel.id, quantity: 1 } });
  await client.materialComponent.create({ data: { parentId: set.id, childId: stoel.id, quantity: 1 } });
}, 60_000);

afterAll(async () => {
  await client.$disconnect();
  fs.rmSync(DB_PATH, { force: true });
});

describe("material-shortage integration — flat overboeken", () => {
  it("without allowOverbook, requesting more than free throws UNAVAIL and books nothing", async () => {
    let err: (Error & { code?: string }) | null = null;
    try {
      await bookFlatMaterial({
        periodId: ids.period,
        materialId: ids.kaars,
        quantity: 50,
        from: WINDOW.start,
        to: WINDOW.end,
        dayPriceSnapshot: 2,
        setupCostSnapshot: 0,
        client,
      });
    } catch (e) {
      err = e as Error & { code?: string };
    }
    expect(err?.code).toBe("UNAVAIL");
    const booked = await client.periodStockItem.findMany({
      where: { stockItem: { materialId: ids.kaars } },
    });
    expect(booked).toHaveLength(0);
  });

  it("with allowOverbook, 50 requested against 10 free books all 10 and records a shortage of 40", async () => {
    const result = await bookFlatMaterial({
      periodId: ids.period,
      materialId: ids.glas,
      materialName: "Glas",
      quantity: 50,
      from: WINDOW.start,
      to: WINDOW.end,
      dayPriceSnapshot: 5,
      setupCostSnapshot: 0,
      allowOverbook: true,
      client,
    });
    expect(result.assignments).toHaveLength(10);
    expect(result.warnings).toEqual(["40× Glas overboekt — niet in voorraad"]);

    const shortages = await client.periodMaterialShortage.findMany({ where: { materialId: ids.glas } });
    expect(shortages).toHaveLength(1);
    expect(shortages[0].quantity).toBe(40);
    expect(shortages[0].bundleBookingId).toBeNull();
  });

  it("assertNoShortages throws OVERBOOK while the Glas shortage is open", async () => {
    let err: (Error & { code?: string }) | null = null;
    try {
      await assertNoShortages(ids.project, client);
    } catch (e) {
      err = e as Error & { code?: string };
    }
    expect(err?.code).toBe("OVERBOOK");
  });

  it("adding 40 more Glas units and running fillShortages books them and clears the shortage row", async () => {
    await client.stockItem.createMany({
      data: Array.from({ length: 40 }, (_, i) => ({ materialId: ids.glas, unitNumber: i + 11 })),
    });

    const { filled, remaining } = await fillShortages(ids.project, client);
    expect(filled).toBe(40);
    expect(remaining).toHaveLength(0);

    const booked = await client.periodStockItem.findMany({
      where: { periodId: ids.period, stockItem: { materialId: ids.glas } },
    });
    expect(booked).toHaveLength(50);
    const shortages = await client.periodMaterialShortage.findMany({ where: { materialId: ids.glas } });
    expect(shortages).toHaveLength(0);
  });

  it("assertNoShortages resolves once every shortage is filled", async () => {
    await expect(assertNoShortages(ids.project, client)).resolves.toBeUndefined();
  });
});

describe("material-shortage integration — bundle overboeken", () => {
  it("booking a set with only 2 complete sets free, 5 requested with allowOverbook, books the full quantity and records per-component shortages", async () => {
    const result = await bookBundleMaterial({
      periodId: ids.period,
      materialId: ids.set,
      quantity: 5,
      from: WINDOW.start,
      to: WINDOW.end,
      dayPriceSnapshot: 8,
      allowOverbook: true,
      components: [
        { childId: ids.tafel, childName: "Tafel", quantity: 1, dayPrice: 5 },
        { childId: ids.stoel, childName: "Stoel", quantity: 1, dayPrice: 3 },
      ],
      client,
    });

    const bBooking = result.bundleBooking as { id: number; quantity: number };
    expect(bBooking.quantity).toBe(5);

    const tafelAssignments = await client.periodStockItem.findMany({
      where: { periodId: ids.period, bundleBookingId: bBooking.id, stockItem: { materialId: ids.tafel } },
    });
    expect(tafelAssignments).toHaveLength(5);
    const stoelAssignments = await client.periodStockItem.findMany({
      where: { periodId: ids.period, bundleBookingId: bBooking.id, stockItem: { materialId: ids.stoel } },
    });
    expect(stoelAssignments).toHaveLength(2);

    const componentShortages = await client.periodMaterialShortage.findMany({
      where: { bundleBookingId: bBooking.id },
    });
    expect(componentShortages).toHaveLength(1);
    expect(componentShortages[0].materialId).toBe(ids.stoel);
    expect(componentShortages[0].quantity).toBe(3);
    expect(componentShortages[0].dayPriceSnapshot).toBe(0);
    expect(result.warnings).toEqual(["3× Stoel overboekt — niet in voorraad"]);
  });

  it("periodMaterialsCost prices the bundle booking at the full requested quantity (5 sets), not just the 2 fulfilled", async () => {
    const period = await client.period.findUniqueOrThrow({ where: { id: ids.period } });
    const days = periodDays({
      startDate: period.startDate.toISOString(),
      endDate: period.endDate.toISOString(),
    });

    const bundleBookings = await client.periodBundleBooking.findMany({
      where: { periodId: ids.period, materialId: ids.set },
    });
    const shortages = await client.periodMaterialShortage.findMany({
      where: { periodId: ids.period, bundleBookingId: { not: null } },
      include: { material: true },
    });

    const fullPeriod: Period = {
      id: period.id,
      projectId: period.projectId,
      name: period.name,
      startDate: period.startDate.toISOString(),
      endDate: period.endDate.toISOString(),
      updatedAt: period.updatedAt.toISOString(),
      materials: [],
      people: [],
      bundleBookings: bundleBookings as unknown as PeriodBundleBooking[],
      shortages: shortages as unknown as PeriodMaterialShortage[],
    };

    // Only the Set's own booking (5 × dayPriceSnapshot 8 × days) counts —
    // the component shortage row is dayPriceSnapshot 0 and excluded.
    expect(periodMaterialsCost(fullPeriod)).toBe(8 * days * 5);
  });
});
