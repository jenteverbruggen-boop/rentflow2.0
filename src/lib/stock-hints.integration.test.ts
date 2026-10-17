import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

vi.stubEnv("DATABASE_URL", `file:/tmp/hints-init.db`);
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { execSync } from "child_process";
import os from "os";
import path from "path";
import fs from "fs";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "@/generated/prisma/client";
import { prisma as mockedPrisma } from "@/lib/prisma";
import { bookFlatMaterial } from "@/lib/booking";
import { computeStockHints } from "@/lib/stock-hints";

const DB_PATH = path.join(os.tmpdir(), `hints-${process.pid}.db`);
const DB_URL = `file:${DB_PATH}`;

let client: PrismaClient;
let supplierId: number;
let materialId: number;

beforeAll(async () => {
  execSync(`DATABASE_URL=${DB_URL} npx prisma db push --schema=prisma/schema.dev.prisma`, { stdio: "pipe" });
  client = new PrismaClient({ adapter: new PrismaLibSql({ url: DB_URL }) } as never);
  Object.assign(mockedPrisma as object, client);
  supplierId = (await client.supplier.create({ data: { name: "Funrent" } })).id;
  materialId = (await client.material.create({ data: { name: "Tafel", dayPrice: 10 } })).id;
  await client.stockItem.createMany({ data: [1, 2, 3, 4].map((unitNumber) => ({ materialId, unitNumber })) });
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

describe("computeStockHints (C1)", () => {
  it("says how many are free and who holds the rest, and sizes hired rows against own stock", async () => {
    const a = await project("Alpha");
    await bookFlatMaterial({ periodId: a.periodId, materialId, quantity: 3, from, to, dayPriceSnapshot: 10, setupCostSnapshot: 0, client });
    const me = await project("Mijn project");
    const open = await client.periodMaterialShortage.create({ data: { periodId: me.periodId, materialId, quantity: 5, dayPriceSnapshot: 10 } });
    const hired = await client.periodMaterialShortage.create({ data: { periodId: me.periodId, materialId, quantity: 1, dayPriceSnapshot: 10, supplierId } });

    const hints = await computeStockHints(me.projectId, client);
    expect(hints.find((h) => h.shortageId === open.id)).toEqual({
      shortageId: open.id, kind: "open", freeNow: 1, more: 0,
      holders: [{ projectId: a.projectId, name: "Alpha", status: "concept", units: 3 }],
    });
    expect(hints.find((h) => h.shortageId === hired.id)).toEqual({ shortageId: hired.id, kind: "hired", ownFreeNow: 1 });
  });

  it("lists at most 3 holders and counts the rest", async () => {
    const m = await client.material.create({ data: { name: "Stoel", dayPrice: 1 } });
    await client.stockItem.createMany({ data: [1, 2, 3, 4, 5].map((unitNumber) => ({ materialId: m.id, unitNumber })) });
    for (const name of ["P1", "P2", "P3", "P4", "P5"]) {
      const p = await project(name);
      await bookFlatMaterial({ periodId: p.periodId, materialId: m.id, quantity: 1, from, to, dayPriceSnapshot: 1, setupCostSnapshot: 0, client });
    }
    const me = await project("Ik");
    const open = await client.periodMaterialShortage.create({ data: { periodId: me.periodId, materialId: m.id, quantity: 2, dayPriceSnapshot: 1 } });
    const hint = (await computeStockHints(me.projectId, client)).find((h) => h.shortageId === open.id);
    expect(hint).toMatchObject({ kind: "open", freeNow: 0, more: 2 });
    expect(hint && hint.kind === "open" && hint.holders).toHaveLength(3);
  });
});
