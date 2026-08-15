import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execSync } from "child_process";
import os from "os";
import path from "path";
import fs from "fs";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "@/generated/prisma/client";
import { backfillPeriodPersonFunctions } from "./backfill-period-person-functions";

const DB_PATH = path.join(os.tmpdir(), `backfill-functions-${process.pid}.db`);
const DB_URL = `file:${DB_PATH}`;

let client: PrismaClient;

beforeAll(async () => {
  execSync(`DATABASE_URL=${DB_URL} npx prisma db push --schema=prisma/schema.dev.prisma`, {
    stdio: "pipe",
  });
  const adapter = new PrismaLibSql({ url: DB_URL });
  client = new PrismaClient({ adapter } as never);
}, 60_000);

afterAll(async () => {
  await client.$disconnect();
  fs.rmSync(DB_PATH, { force: true });
});

describe("backfillPeriodPersonFunctions (L2.1)", () => {
  it("matches an exact role/Function.name pair and logs the ones that don't match — not just the seed's clean 1:1 case", async () => {
    const electrician = await client.function.create({ data: { name: "Electrician" } });
    const person = await client.person.create({ data: { name: "Bob", dayPrice: 300 } });
    const otherPerson = await client.person.create({ data: { name: "Sparky Guy", dayPrice: 300 } });
    const project = await client.project.create({
      data: { name: "Test Project", startDate: new Date("2026-09-01"), endDate: new Date("2026-09-05") },
    });
    const period = await client.period.create({
      data: { projectId: project.id, name: "Main", startDate: new Date("2026-09-01"), endDate: new Date("2026-09-05") },
    });

    const matching = await client.periodPerson.create({
      data: { periodId: period.id, personId: person.id, role: "Electrician", dayPriceSnapshot: 300 },
    });
    // Deliberately mismatched — no Function named "Sparky" exists. This
    // is the exact case the brief flags as the one dev seed data (a
    // clean 1:1 match) would never exercise.
    const mismatched = await client.periodPerson.create({
      data: { periodId: period.id, personId: otherPerson.id, role: "Sparky", dayPriceSnapshot: 300 },
    });

    const result = await backfillPeriodPersonFunctions(client);

    expect(result.matched).toBe(1);
    expect(result.unmatched).toEqual([{ id: mismatched.id, role: "Sparky" }]);

    const updated = await client.periodPerson.findUnique({ where: { id: matching.id } });
    expect(updated?.functionId).toBe(electrician.id);
    const untouched = await client.periodPerson.findUnique({ where: { id: mismatched.id } });
    expect(untouched?.functionId).toBeNull();
  });

  it("never touches a row that already has a functionId", async () => {
    const otherFn = await client.function.create({ data: { name: "Plumber" } });
    const person = await client.person.create({ data: { name: "Charlie", dayPrice: 250 } });
    const project = await client.project.create({
      data: { name: "Another Project", startDate: new Date("2026-09-01"), endDate: new Date("2026-09-05") },
    });
    const period = await client.period.create({
      data: { projectId: project.id, name: "Main", startDate: new Date("2026-09-01"), endDate: new Date("2026-09-05") },
    });
    const already = await client.periodPerson.create({
      data: {
        periodId: period.id,
        personId: person.id,
        role: "Carpenter",
        functionId: otherFn.id,
        dayPriceSnapshot: 250,
      },
    });

    await backfillPeriodPersonFunctions(client);

    const untouched = await client.periodPerson.findUnique({ where: { id: already.id } });
    expect(untouched?.functionId).toBe(otherFn.id);
  });
});
