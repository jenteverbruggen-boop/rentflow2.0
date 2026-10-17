import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

vi.stubEnv("DATABASE_URL", `file:/tmp/bundle-hire-init.db`);
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { execSync } from "child_process";
import os from "os";
import path from "path";
import fs from "fs";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "@/generated/prisma/client";
import { prisma as mockedPrisma } from "@/lib/prisma";
import { bundleAvailableCount } from "@/lib/availability";
import { bookBundleMaterial } from "@/lib/bundle-booking";

const DB_PATH = path.join(os.tmpdir(), `bundle-hire-${process.pid}.db`);
const DB_URL = `file:${DB_PATH}`;

let client: PrismaClient;
let supplierId: number;
let tableId: number;
let plateId: number;
let setId: number;

beforeAll(async () => {
  execSync(`DATABASE_URL=${DB_URL} npx prisma db push --schema=prisma/schema.dev.prisma`, { stdio: "pipe" });
  client = new PrismaClient({ adapter: new PrismaLibSql({ url: DB_URL }) } as never);
  Object.assign(mockedPrisma as object, client);
  supplierId = (await client.supplier.create({ data: { name: "Funrent" } })).id;
  tableId = (await client.material.create({ data: { name: "Tafel", dayPrice: 1 } })).id;
  plateId = (await client.material.create({ data: { name: "Bord", dayPrice: 1, subhireOnly: true, defaultSupplierId: supplierId } })).id;
  await client.stockItem.createMany({ data: [1, 2].map((unitNumber) => ({ materialId: tableId, unitNumber })) });
  setId = (await client.material.create({ data: { name: "Diner-set", isBundle: true } })).id;
  await client.materialComponent.createMany({
    data: [{ parentId: setId, childId: tableId, quantity: 1 }, { parentId: setId, childId: plateId, quantity: 4 }],
  });
}, 60_000);

afterAll(async () => {
  await client.$disconnect();
  fs.rmSync(DB_PATH, { force: true });
});

const from = new Date("2026-06-01");
const to = new Date("2026-06-03");

async function newPeriod() {
  const c = await client.client.create({ data: { name: `K ${Math.random()}` } });
  const p = await client.project.create({
    data: { name: `P ${Math.random()}`, clientId: c.id, status: "bevestigd", startDate: from, endDate: to,
      periods: { create: [{ name: "E", startDate: from, endDate: to }] } },
    include: { periods: true },
  });
  return p.periods[0].id;
}

const comps = (supplier: number | null) => [
  { childId: tableId, quantity: 1, childName: "Tafel", dayPrice: 1, subhire: supplier ? { supplierId: supplier, basis: "per_huur" as const, unitCost: null, costOverride: null } : null },
  { childId: plateId, quantity: 4, childName: "Bord", dayPrice: 1, subhire: { supplierId, basis: "per_huur" as const, unitCost: 0.2, costOverride: null } },
];

describe("sets with an inhuur-only component (A2)", () => {
  it("the inhuur-only component does not limit availability", async () => {
    expect(await bundleAvailableCount(setId, { from, to }, client)).toBe(2);
  });

  it("an inhuur-only component without a usable supplier counts its real stock (0)", async () => {
    const archived = (await client.supplier.create({ data: { name: "Weg", archived: true } })).id;
    const orphan = (await client.material.create({ data: { name: "Wees", dayPrice: 1, subhireOnly: true, defaultSupplierId: archived } })).id;
    const set2 = (await client.material.create({ data: { name: "Set 2", isBundle: true } })).id;
    await client.materialComponent.createMany({
      data: [{ parentId: set2, childId: tableId, quantity: 1 }, { parentId: set2, childId: orphan, quantity: 1 }],
    });
    expect(await bundleAvailableCount(set2, { from, to }, client)).toBe(0);
  });

  it("is bookable: the plates are hired in", async () => {
    const periodId = await newPeriod();
    await bookBundleMaterial({ periodId, materialId: setId, quantity: 2, from, to, dayPriceSnapshot: 5, components: comps(null), client });
    const rows = await client.periodMaterialShortage.findMany({ where: { periodId } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ materialId: plateId, quantity: 8, supplierId });
  });

  it("a short other component names itself and carries numbers", async () => {
    const periodId = await newPeriod();
    await expect(
      bookBundleMaterial({ periodId, materialId: setId, quantity: 1, from, to, dayPriceSnapshot: 5, components: comps(null), client }),
    ).rejects.toMatchObject({ code: "UNAVAIL", message: "Onvoldoende voorraad voor Tafel", shortfall: { requested: 1, available: 0 } });
  });
});
