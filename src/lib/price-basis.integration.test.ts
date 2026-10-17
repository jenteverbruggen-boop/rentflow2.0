import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

vi.stubEnv("DATABASE_URL", `file:/tmp/basis-init.db`);
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { execSync } from "child_process";
import os from "os";
import path from "path";
import fs from "fs";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "@/generated/prisma/client";
import { prisma as mockedPrisma } from "@/lib/prisma";
import { bookFlatMaterial } from "@/lib/booking";
import { fillShortages } from "@/lib/material-shortage-db";
import { subhireShortage, undoSubhire } from "@/lib/subhire";
import { takeOwnStockForHire } from "@/lib/subhire-to-stock";
import { releaseProjectStock } from "@/lib/release-cancelled-stock";

const DB_PATH = path.join(os.tmpdir(), `basis-${process.pid}.db`);
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

const release = (projectId: number) =>
  client.$transaction((tx) => releaseProjectStock(projectId, tx as unknown as PrismaClient));

async function project(name: string, status = "concept") {
  const c = await client.client.create({ data: { name: `K ${Math.random()}` } });
  const p = await client.project.create({
    data: { name, clientId: c.id, status, startDate: from, endDate: to, periods: { create: [{ name: "E", startDate: from, endDate: to }] } },
    include: { periods: true },
  });
  return { projectId: p.id, periodId: p.periods[0].id };
}

describe("price basis snapshot follows the booking (E1)", () => {
  it("is snapshotted at booking and survives fill, hire split, undo, to-stock and release", async () => {
    const m = await client.material.create({ data: { name: "Bord", dayPrice: 0.38, priceBasis: "per_huur", defaultSupplierId: supplierId } });
    await client.stockItem.createMany({ data: [1, 2].map((unitNumber) => ({ materialId: m.id, unitNumber })) });
    const { projectId, periodId } = await project("P", "concept");
    await bookFlatMaterial({ periodId, materialId: m.id, quantity: 5, from, to, dayPriceSnapshot: 0.38, priceBasis: "per_huur", setupCostSnapshot: 0, allowOverbook: true, client });
    expect((await client.periodStockItem.findMany({ where: { periodId } })).map((u) => u.priceBasisSnapshot)).toEqual(["per_huur", "per_huur"]);
    const open = await client.periodMaterialShortage.findFirstOrThrow({ where: { periodId } });
    expect(open).toMatchObject({ quantity: 3, priceBasisSnapshot: "per_huur" });

    // Hire 2 of the 3: the split row keeps the basis.
    await subhireShortage(periodId, open.id, { supplierId, quantity: 2 }, client);
    const hired = await client.periodMaterialShortage.findFirstOrThrow({ where: { periodId, supplierId } });
    expect(hired.priceBasisSnapshot).toBe("per_huur");
    // Undo folds back into the open row (same basis) rather than piling up.
    await undoSubhire(periodId, hired.id, client);
    expect(await client.periodMaterialShortage.count({ where: { periodId } })).toBe(1);

    // Free units, then fill: owned units copy the basis.
    await release(projectId);
    const afterRelease = await client.periodMaterialShortage.findMany({ where: { periodId } });
    expect(afterRelease).toHaveLength(1);
    expect(afterRelease[0]).toMatchObject({ quantity: 5, priceBasisSnapshot: "per_huur" });
    await fillShortages(projectId, client);
    expect((await client.periodStockItem.findMany({ where: { periodId } })).every((u) => u.priceBasisSnapshot === "per_huur")).toBe(true);

    // Hire the rest, free a unit by cancelling elsewhere is not needed: to-stock needs a free unit.
    const rest = await client.periodMaterialShortage.findFirstOrThrow({ where: { periodId } });
    await subhireShortage(periodId, rest.id, { supplierId }, client);
    await client.periodStockItem.deleteMany({ where: { periodId } });
    await takeOwnStockForHire(periodId, rest.id, 1, client);
    const converted = await client.periodStockItem.findMany({ where: { periodId } });
    expect(converted).toHaveLength(1);
    expect(converted[0].priceBasisSnapshot).toBe("per_huur");
  });

  it("a per_dag booking is unchanged (default)", async () => {
    const m = await client.material.create({ data: { name: "Tent", dayPrice: 50 } });
    await client.stockItem.create({ data: { materialId: m.id, unitNumber: 1 } });
    const { periodId } = await project("Q", "concept");
    await bookFlatMaterial({ periodId, materialId: m.id, quantity: 1, from, to, dayPriceSnapshot: 50, setupCostSnapshot: 0, client });
    expect((await client.periodStockItem.findFirstOrThrow({ where: { periodId } })).priceBasisSnapshot).toBe("per_dag");
  });
});
