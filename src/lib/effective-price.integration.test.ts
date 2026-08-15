import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

vi.stubEnv("DATABASE_URL", `file:/tmp/effective-price-init.db`);
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { execSync } from "child_process";
import os from "os";
import path from "path";
import fs from "fs";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "@/generated/prisma/client";

const DB_PATH = path.join(os.tmpdir(), `effective-price-${process.pid}.db`);
const DB_URL = `file:${DB_PATH}`;

let client: PrismaClient;
// effective-price.ts imports `prisma` from "@/lib/prisma" directly
// (mocked above to an empty object so this file can control its own
// DB). Copying the real client's model delegates onto that mocked
// export lets effectiveMaterialPrice/effectivePersonPrice run their
// actual Prisma queries against a real SQLite database, the same
// pattern booking.integration.test.ts and scope-enumeration use for
// money-critical logic this codebase doesn't trust to a hand-rolled
// mock.
import { prisma as mockedPrisma } from "@/lib/prisma";
import {
  effectiveMaterialPrice,
  effectivePersonPrice,
} from "@/lib/effective-price";

const ids = {
  project: 0,
  clientId: 0,
  material: 0,
  person: 0,
  fnElec: 0,
  historicalPersonId: 0,
  historicalProjectId: 0,
};

beforeAll(async () => {
  execSync(`DATABASE_URL=${DB_URL} npx prisma db push --schema=prisma/schema.dev.prisma`, {
    stdio: "pipe",
  });

  const adapter = new PrismaLibSql({ url: DB_URL });
  client = new PrismaClient({ adapter } as never);
  // Point effective-price.ts's `prisma` import at this real client.
  Object.assign(mockedPrisma as object, client);

  const clientRow = await client.client.create({ data: { name: "Test Client" } });
  ids.clientId = clientRow.id;

  const project = await client.project.create({
    data: {
      name: "Test Project",
      clientId: clientRow.id,
      startDate: new Date("2026-09-01"),
      endDate: new Date("2026-09-10"),
    },
  });
  ids.project = project.id;

  const material = await client.material.create({ data: { name: "Tent", dayPrice: 100 } });
  ids.material = material.id;

  const person = await client.person.create({ data: { name: "Bob", dayPrice: 300 } });
  ids.person = person.id;

  const fnElec = await client.function.create({
    data: { name: "Electrician", dayRate: 320, hourRate: 45 },
  });
  ids.fnElec = fnElec.id;

  await client.personFunction.create({
    data: { personId: person.id, functionId: fnElec.id, dayRate: 280, hourRate: 38 },
  });

  // Historical fixture: a PeriodPerson row created "before" this phase,
  // rateSnapshot: null, dayPriceSnapshot frozen at a value that would
  // NOT match the person's current dayPrice — proving effectivePersonPrice
  // (called with no functionId, exactly as every pre-L2 caller does)
  // never recomputes it.
  const historicalPerson = await client.person.create({ data: { name: "Historical Alice", dayPrice: 999 } });
  ids.historicalPersonId = historicalPerson.id;
  const historicalProject = await client.project.create({
    data: { name: "Historical Project", startDate: new Date("2025-01-01"), endDate: new Date("2025-01-05") },
  });
  ids.historicalProjectId = historicalProject.id;
}, 60_000);

afterAll(async () => {
  await client.$disconnect();
  fs.rmSync(DB_PATH, { force: true });
});

describe("effectiveMaterialPrice (L1.2)", () => {
  it("project override beats the material's own dayPrice", async () => {
    await client.projectMaterialPrice.create({
      data: { projectId: ids.project, materialId: ids.material, dayPrice: 80 },
    });
    const result = await effectiveMaterialPrice(ids.project, ids.material);
    expect(result).toEqual({ amount: 80, source: "project" });
    await client.projectMaterialPrice.deleteMany({ where: { projectId: ids.project, materialId: ids.material } });
  });

  it("falls back to Material.dayPrice with no override", async () => {
    const result = await effectiveMaterialPrice(ids.project, ids.material);
    expect(result).toEqual({ amount: 100, source: "material" });
  });

  it("returns 0/none for a material that doesn't exist", async () => {
    const result = await effectiveMaterialPrice(ids.project, 999_999);
    expect(result).toEqual({ amount: 0, source: "none" });
  });
});

describe("effectivePersonPrice — five-level resolution order (L1.2, Q30/Q32b)", () => {
  it("project override beats everything, even a function/client/person rate", async () => {
    await client.projectPersonPrice.create({
      data: { projectId: ids.project, personId: ids.person, dayPrice: 999 },
    });
    const result = await effectivePersonPrice(ids.project, ids.person, ids.fnElec, "dag");
    expect(result).toEqual({ amount: 999, source: "project", unit: "dag" });
    await client.projectPersonPrice.deleteMany({ where: { projectId: ids.project, personId: ids.person } });
  });

  it("client rate card wins over a higher person-function rate", async () => {
    await client.clientFunctionRate.create({
      data: { clientId: ids.clientId, functionId: ids.fnElec, dayRate: 300, hourRate: 42 },
    });
    const result = await effectivePersonPrice(ids.project, ids.person, ids.fnElec, "dag");
    expect(result).toEqual({ amount: 300, source: "client", unit: "dag" });
    await client.clientFunctionRate.deleteMany({ where: { clientId: ids.clientId, functionId: ids.fnElec } });
  });

  it("person-function override wins over the function default when no client rate exists", async () => {
    const result = await effectivePersonPrice(ids.project, ids.person, ids.fnElec, "dag");
    expect(result).toEqual({ amount: 280, source: "person-function", unit: "dag" });
  });

  it("the hour unit resolves the person-function hourRate", async () => {
    const result = await effectivePersonPrice(ids.project, ids.person, ids.fnElec, "uur");
    expect(result).toEqual({ amount: 38, source: "person-function", unit: "uur" });
  });

  it("falls to the function default when the person has no override for that function", async () => {
    const other = await client.person.create({ data: { name: "No Override Person", dayPrice: 250 } });
    const result = await effectivePersonPrice(ids.project, other.id, ids.fnElec, "dag");
    expect(result).toEqual({ amount: 320, source: "function", unit: "dag" });
  });

  it("Q19 fallback: an hourly request against a function/person with no hour rate falls to Person.dayPrice, echoing unit: dag", async () => {
    const fnNoHourly = await client.function.create({ data: { name: "Carpenter", dayRate: 260 } });
    const carpenter = await client.person.create({ data: { name: "Carpenter Guy", dayPrice: 250 } });
    // fnNoHourly has a dayRate but no hourRate, and no PersonFunction row
    // exists linking them, so this exercises level 4 (function) first —
    // its hourRate is null, so it must NOT match at level 4 either, and
    // resolution must fall all the way to level 5 (person.dayPrice).
    const result = await effectivePersonPrice(ids.project, carpenter.id, fnNoHourly.id, "uur");
    expect(result).toEqual({ amount: 250, source: "person", unit: "dag" });
  });

  it("no rate anywhere resolves to 0/none", async () => {
    const nobody = await client.person.create({ data: { name: "Zero", dayPrice: 0 } });
    const result = await effectivePersonPrice(ids.project, nobody.id, null, "dag");
    expect(result).toEqual({ amount: 0, source: "none", unit: "dag" });
  });

  it("with no functionId (every pre-L2 caller), resolution is the old 2-level order: project override, then Person.dayPrice", async () => {
    const result = await effectivePersonPrice(ids.project, ids.person);
    expect(result).toEqual({ amount: 300, source: "person", unit: "dag" });
  });
});

describe("historical protection — L1.2 must not recompute existing snapshots", () => {
  it("a byte-identical historical booking is untouched by calling effectivePersonPrice the same way every pre-L2 route does", async () => {
    // Simulates the exact call shape periods/[id]/people/route.ts used
    // before L2 lands: no functionId, no unit — this must resolve to
    // exactly what the OLD 2-level (project override -> Person.dayPrice)
    // resolver would have produced: the historical person's dayPrice,
    // untouched by any of the three new levels this commit inserted.
    const result = await effectivePersonPrice(ids.historicalProjectId, ids.historicalPersonId);
    expect(result).toEqual({ amount: 999, source: "person", unit: "dag" });
  });
});
