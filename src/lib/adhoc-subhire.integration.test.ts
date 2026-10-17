import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

vi.stubEnv("DATABASE_URL", `file:/tmp/adhoc-init.db`);
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { execSync } from "child_process";
import os from "os";
import path from "path";
import fs from "fs";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "@/generated/prisma/client";
import { prisma as mockedPrisma } from "@/lib/prisma";
import { createAdhocSubhire } from "@/lib/adhoc-subhire";
import { listProjectShortages } from "@/lib/material-shortage-db";

const DB_PATH = path.join(os.tmpdir(), `adhoc-${process.pid}.db`);
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

async function period(status = "bevestigd") {
  const c = await client.client.create({ data: { name: `K ${Math.random()}` } });
  const p = await client.project.create({
    data: { name: `P ${Math.random()}`, clientId: c.id, status, startDate: new Date("2026-06-01"), endDate: new Date("2026-06-03"),
      periods: { create: [{ name: "E", startDate: new Date("2026-06-01"), endDate: new Date("2026-06-03") }] } },
    include: { periods: true },
  });
  return { projectId: p.id, periodId: p.periods[0].id };
}

describe("createAdhocSubhire (E5)", () => {
  it("creates an inhuur-only item and a resolved hired row, in a confirmed project, reusing the category", async () => {
    const a = await period();
    const result = await createAdhocSubhire(a.periodId, {
      name: "Bord (Funrent)", supplierId, quantity: 4, dayPrice: 0.38, unitCost: 0.2,
    }, client);
    expect(result.material).toMatchObject({ subhireOnly: true, defaultSupplierId: supplierId, priceBasis: "per_huur", subhireCostBasis: "per_huur" });
    const rows = await client.periodMaterialShortage.findMany({ where: { periodId: a.periodId } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ materialId: result.material.id, quantity: 4, supplierId, priceBasisSnapshot: "per_huur", dayPriceSnapshot: 0.38, subhireUnitCost: 0.2 });
    expect(await listProjectShortages(a.projectId, client)).toEqual([]); // nothing open

    const b = await period("concept");
    await createAdhocSubhire(b.periodId, { name: "Glas (Funrent)", supplierId, quantity: 1 }, client);
    expect(await client.category.count({ where: { name: "Inhuur" } })).toBe(1);
    expect(result.material.code).toBe("9990-001");
    expect((await client.material.findFirstOrThrow({ where: { name: "Glas (Funrent)" } })).code).toBe("9990-002");
    expect((await client.material.findFirstOrThrow({ where: { name: "Glas (Funrent)" } })).dayPrice).toBe(0);
  });

  it("refuses a duplicate name and returns the existing item", async () => {
    const a = await period();
    await createAdhocSubhire(a.periodId, { name: "Tent XL", supplierId, quantity: 1 }, client);
    const existing = await client.material.findFirstOrThrow({ where: { name: "Tent XL" } });
    await expect(createAdhocSubhire(a.periodId, { name: "Tent XL", supplierId, quantity: 2 }, client))
      .rejects.toMatchObject({ code: "NAME_TAKEN", materialId: existing.id });
    expect(await client.material.count({ where: { name: "Tent XL" } })).toBe(1);
  });

  it("refuses an archived supplier and rolls back the material", async () => {
    const a = await period();
    const old = (await client.supplier.create({ data: { name: "Oud", archived: true } })).id;
    await expect(createAdhocSubhire(a.periodId, { name: "Niks", supplierId: old, quantity: 1 }, client)).rejects.toMatchObject({ code: "BAD_SUPPLIER" });
    expect(await client.material.count({ where: { name: "Niks" } })).toBe(0);
  });
});
