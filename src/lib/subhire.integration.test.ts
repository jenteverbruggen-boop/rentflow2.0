import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

vi.stubEnv("DATABASE_URL", `file:/tmp/subhire-init.db`);
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { execSync } from "child_process";
import os from "os";
import path from "path";
import fs from "fs";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "@/generated/prisma/client";
import { prisma as mockedPrisma } from "@/lib/prisma";
import { subhireShortage, updateSubhire, undoSubhire, SubhireError } from "@/lib/subhire";
import { listProjectShortages, fillShortages, assertNoShortages } from "@/lib/material-shortage-db";
import { createOrIncrementShortage } from "@/lib/shortage-row";
import { mergeShortagesIntoGroups } from "@/lib/material-shortage";
import { subhireTotal } from "@/lib/subhire-cost";
import { createDraftInvoice } from "@/lib/create-draft-invoice";
import { deleteSupplier, SupplierInUseError } from "@/lib/suppliers";
import { toNumber } from "@/lib/serialize";
import type { PeriodMaterialShortage } from "@/types";

const DB_PATH = path.join(os.tmpdir(), `subhire-${process.pid}.db`);
const DB_URL = `file:${DB_PATH}`;

let client: PrismaClient;
let supplierId: number;
let archivedSupplierId: number;
let materialId: number;

beforeAll(async () => {
  execSync(`DATABASE_URL=${DB_URL} npx prisma db push --schema=prisma/schema.dev.prisma`, { stdio: "pipe" });
  client = new PrismaClient({ adapter: new PrismaLibSql({ url: DB_URL }) } as never);
  Object.assign(mockedPrisma as object, client);
  supplierId = (await client.supplier.create({ data: { name: "Funrent" } })).id;
  archivedSupplierId = (await client.supplier.create({ data: { name: "Oud", archived: true } })).id;
  materialId = (
    await client.material.create({
      data: { name: "Bierbank", dayPrice: 4, defaultSupplierId: supplierId, subhireUnitCost: 1.5, subhireCostBasis: "per_dag" },
    })
  ).id;
}, 60_000);

afterAll(async () => {
  await client.$disconnect();
  fs.rmSync(DB_PATH, { force: true });
});

async function setup(qty = 5) {
  const clientRow = await client.client.create({ data: { name: `K ${Math.random()}` } });
  const project = await client.project.create({
    data: {
      name: `Inhuur ${Math.random()}`, clientId: clientRow.id,
      startDate: new Date("2026-06-01"), endDate: new Date("2026-06-03"),
      periods: { create: [{ name: "Event", startDate: new Date("2026-06-01"), endDate: new Date("2026-06-03") }] },
    },
    include: { periods: true },
  });
  const periodId = project.periods[0].id;
  const shortage = await client.periodMaterialShortage.create({
    data: { periodId, materialId, quantity: qty, dayPriceSnapshot: 4 },
  });
  return { projectId: project.id, periodId, shortage };
}

describe("hiring a shortage in (C3)", () => {
  it("resolves the row: it stops being an open shortage, with the material's default supplier cost", async () => {
    const { projectId, periodId, shortage } = await setup();
    await expect(assertNoShortages(projectId, client)).rejects.toMatchObject({ code: "OVERBOOK" });

    const row = await subhireShortage(periodId, shortage.id, { supplierId }, client);
    expect(row).toMatchObject({ supplierId, subhireCostBasis: "per_dag", quantity: 5 });
    expect(toNumber(row.subhireUnitCost)).toBe(1.5);
    expect(row.subhiredAt).toBeTruthy();

    expect(await listProjectShortages(projectId, client)).toEqual([]);
    await expect(assertNoShortages(projectId, client)).resolves.toBeUndefined();
    // 5 units × €1.50 × 3 days
    expect(subhireTotal(row, 3)).toBe(22.5);
  });

  it("a partial hire splits the row: the hired part is resolved, the rest stays open", async () => {
    const { projectId, periodId, shortage } = await setup();
    const hired = await subhireShortage(periodId, shortage.id, { supplierId, quantity: 2, basis: "per_huur", unitCost: 10 }, client);
    expect(hired).toMatchObject({ quantity: 2, supplierId, subhireCostBasis: "per_huur" });
    expect(subhireTotal(hired, 3)).toBe(20);
    const open = await listProjectShortages(projectId, client);
    expect(open).toHaveLength(1);
    expect(open[0].quantity).toBe(3);
  });

  it("an explicit total overrides, and 'no cost known' is allowed", async () => {
    const a = await setup();
    const withOverride = await subhireShortage(a.periodId, a.shortage.id, { supplierId, costOverride: 99 }, client);
    expect(subhireTotal(withOverride, 3)).toBe(99);
    const b = await setup();
    const unknown = await subhireShortage(b.periodId, b.shortage.id, { supplierId, unitCost: null }, client);
    expect(subhireTotal(unknown, 3)).toBeNull();
  });

  it("refuses an archived supplier, a bad quantity, another period's row and a second hire", async () => {
    const { periodId, shortage } = await setup();
    await expect(subhireShortage(periodId, shortage.id, { supplierId: archivedSupplierId }, client)).rejects.toMatchObject({ code: "BAD_SUPPLIER" });
    await expect(subhireShortage(periodId, shortage.id, { supplierId, quantity: 6 }, client)).rejects.toMatchObject({ code: "BAD_QUANTITY" });
    await expect(subhireShortage(periodId + 999, shortage.id, { supplierId }, client)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await subhireShortage(periodId, shortage.id, { supplierId }, client);
    await expect(subhireShortage(periodId, shortage.id, { supplierId }, client)).rejects.toBeInstanceOf(SubhireError);
  });
});

describe("hired-in rows are protected from the overbook machinery", () => {
  it("fillShortages leaves a hired-in row alone and still fills the open one", async () => {
    const { projectId, periodId, shortage } = await setup(5);
    await subhireShortage(periodId, shortage.id, { supplierId, quantity: 2 }, client);
    await client.stockItem.createMany({ data: [1, 2, 3, 4, 5].map((unitNumber) => ({ materialId, unitNumber })) });
    await fillShortages(projectId, client);
    // The 3 open units were filled from stock; the 2 hired-in ones stay hired-in.
    const rows = await client.periodMaterialShortage.findMany({ where: { periodId } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ quantity: 2, supplierId });
    await client.stockItem.deleteMany({ where: { materialId } });
  });

  it("new overbooked units never fold into a hired-in row", async () => {
    const { periodId, shortage } = await setup(3);
    await subhireShortage(periodId, shortage.id, { supplierId }, client);
    await client.$transaction(async (tx) => {
      await createOrIncrementShortage(tx as unknown as PrismaClient, { periodId, materialId, quantity: 2, dayPriceSnapshot: 4 });
    });
    const rows = await client.periodMaterialShortage.findMany({ where: { periodId }, orderBy: { id: "asc" } });
    expect(rows.map((r) => [r.quantity, r.supplierId])).toEqual([[3, supplierId], [2, null]]);
  });

  it("grouping counts hired-in units as billed units, but not as overbooked", () => {
    const base = { periodId: 1, materialId, bundleBookingId: null, dayPriceSnapshot: 4, setupCostSnapshot: 0, discountPct: null, discountAmount: null, material: { id: materialId, name: "Bierbank" } };
    const groups = mergeShortagesIntoGroups([], [
      { ...base, id: 1, quantity: 3, supplierId: null },
      { ...base, id: 2, quantity: 2, supplierId: 7 },
    ] as unknown as PeriodMaterialShortage[]);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ units: 5, overbookedUnits: 3, subhiredUnits: 2, shortageIds: [1] });
  });
});

describe("changing and undoing a hire", () => {
  it("updates supplier and cost on a hired-in row only", async () => {
    const { periodId, shortage } = await setup();
    await expect(updateSubhire(periodId, shortage.id, { unitCost: 3 }, client)).rejects.toMatchObject({ code: "NOT_SUBHIRED" });
    await subhireShortage(periodId, shortage.id, { supplierId }, client);
    const other = (await client.supplier.create({ data: { name: "Rent-men" } })).id;
    const updated = await updateSubhire(periodId, shortage.id, { supplierId: other, unitCost: 3, costOverride: null }, client);
    expect(updated.supplierId).toBe(other);
    expect(toNumber(updated.subhireUnitCost)).toBe(3);
  });

  it("undoing makes it an open shortage again, merged into an existing open row", async () => {
    const { projectId, periodId, shortage } = await setup(5);
    await subhireShortage(periodId, shortage.id, { supplierId, quantity: 2 }, client);
    const hired = (await client.periodMaterialShortage.findMany({ where: { periodId, supplierId } }))[0];
    await undoSubhire(periodId, hired.id, client);
    const rows = await client.periodMaterialShortage.findMany({ where: { periodId } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ quantity: 5, supplierId: null, subhireUnitCost: null });
    expect(await listProjectShortages(projectId, client)).toHaveLength(1);
    await expect(undoSubhire(periodId, rows[0].id, client)).rejects.toMatchObject({ code: "NOT_SUBHIRED" });
  });
});

describe("billing and suppliers", () => {
  it("a project whose shortages were all hired in can be invoiced, and the units are billed", async () => {
    const { projectId, periodId, shortage } = await setup(4);
    await expect(createDraftInvoice({ projectId, invoiceRole: "standalone" }, client)).rejects.toMatchObject({ code: "OVERBOOK" });
    await subhireShortage(periodId, shortage.id, { supplierId }, client);
    const invoice = await createDraftInvoice({ projectId, invoiceRole: "standalone" }, client);
    const line = invoice.lines.find((l) => l.kind === "material")!;
    expect(toNumber(line.quantity)).toBe(4);
    expect(toNumber(line.unitPrice)).toBe(12); // €4 × 3 days
  });

  it("a supplier in use can't be deleted, an unused one can", async () => {
    await expect(deleteSupplier(supplierId)).rejects.toBeInstanceOf(SupplierInUseError);
    const spare = await client.supplier.create({ data: { name: "Spare" } });
    await expect(deleteSupplier(spare.id)).resolves.toBeUndefined();
  });
});
