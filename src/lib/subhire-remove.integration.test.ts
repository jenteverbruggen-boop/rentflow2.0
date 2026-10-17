import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

vi.stubEnv("DATABASE_URL", `file:/tmp/subhire-remove-init.db`);
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { execSync } from "child_process";
import os from "os";
import path from "path";
import fs from "fs";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "@/generated/prisma/client";
import { prisma as mockedPrisma } from "@/lib/prisma";
import { subhireShortage } from "@/lib/subhire";
import { removeHiredUnits } from "@/lib/subhire-remove";

const DB_PATH = path.join(os.tmpdir(), `subhire-remove-${process.pid}.db`);
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

describe("removeHiredUnits (A1)", () => {
  it("decrements, then deletes at 0, in a confirmed project", async () => {
    const { periodId, rowId } = await setup("bevestigd");
    const first = await removeHiredUnits(periodId, rowId, 1, client);
    expect(first).toEqual({ supplierName: "Funrent", removed: 1 });
    expect((await client.periodMaterialShortage.findUnique({ where: { id: rowId } }))?.quantity).toBe(3);
    await removeHiredUnits(periodId, rowId, "all", client);
    expect(await client.periodMaterialShortage.findUnique({ where: { id: rowId } })).toBeNull();
  });

  it("refuses an open row", async () => {
    const { periodId, rowId } = await setup("concept", 2, false);
    await expect(removeHiredUnits(periodId, rowId, 1, client)).rejects.toMatchObject({ code: "NOT_SUBHIRED" });
  });

  it("refuses a row of another period", async () => {
    const a = await setup("concept");
    const b = await setup("concept");
    await expect(removeHiredUnits(b.periodId, a.rowId, 1, client)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
