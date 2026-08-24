import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

vi.stubEnv("DATABASE_URL", `file:/tmp/function-archive-integration-init.db`);
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { execSync } from "child_process";
import os from "os";
import path from "path";
import fs from "fs";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "@/generated/prisma/client";
import { canHardDeleteFunction, functionDeleteBlockedMessage } from "@/lib/function-deletable";

/**
 * Integration coverage for DELETE/PUT /api/functions/[id]'s actual
 * behaviour against a real schema — same convention as the other
 * `*.integration.test.ts` files (real Prisma client + SQLite dev
 * schema, not a mocked one), exercising the specific relation this
 * feature is about: `PeriodPerson.functionId` has no `onDelete`
 * specified in schema.prisma, so Prisma defaults to `SetNull` on a hard
 * delete. This proves that behaviour is real (not just asserted in a
 * comment) and that `canHardDeleteFunction`'s three counts actually line
 * up with what a hard delete would touch.
 */
const DB_PATH = path.join(os.tmpdir(), `function-archive-integration-${process.pid}.db`);
const DB_URL = `file:${DB_PATH}`;

let client: PrismaClient;
const ids = { unused: 0, assignedToPerson: 0, bookedOnly: 0, clientRated: 0, person: 0, client_: 0, project: 0, period: 0 };

beforeAll(async () => {
  execSync(`DATABASE_URL=${DB_URL} npx prisma db push --schema=prisma/schema.dev.prisma`, {
    stdio: "pipe",
  });
  const adapter = new PrismaLibSql({ url: DB_URL });
  client = new PrismaClient({ adapter } as never);

  const unused = await client.function.create({ data: { name: "Ongebruikte functie" } });
  ids.unused = unused.id;

  const assignedToPerson = await client.function.create({ data: { name: "Rigger" } });
  ids.assignedToPerson = assignedToPerson.id;
  const person = await client.person.create({ data: { name: "Bob", dayPrice: 300 } });
  ids.person = person.id;
  await client.personFunction.create({ data: { personId: person.id, functionId: assignedToPerson.id } });

  // The critical case: zero PersonFunction rows (no current crew
  // assignment) but a real PeriodPerson.functionId booking — the old
  // guard's `_count.people` check alone would have missed this entirely.
  const bookedOnly = await client.function.create({ data: { name: "Historisch geboekt" } });
  ids.bookedOnly = bookedOnly.id;
  const project = await client.project.create({
    data: { name: "Project", startDate: new Date("2026-09-01"), endDate: new Date("2026-09-01") },
  });
  ids.project = project.id;
  const period = await client.period.create({
    data: { projectId: project.id, name: "Dag 1", startDate: new Date("2026-09-01"), endDate: new Date("2026-09-01") },
  });
  ids.period = period.id;
  await client.periodPerson.create({
    data: { periodId: period.id, personId: person.id, functionId: bookedOnly.id, dayPriceSnapshot: 300 },
  });

  const clientRated = await client.function.create({ data: { name: "Klanttarief-functie" } });
  ids.clientRated = clientRated.id;
  const clientRow = await client.client.create({ data: { name: "Acme" } });
  ids.client_ = clientRow.id;
  await client.clientFunctionRate.create({ data: { clientId: clientRow.id, functionId: clientRated.id, dayRate: 350 } });
}, 60_000);

afterAll(async () => {
  await client.$disconnect();
  fs.rmSync(DB_PATH, { force: true });
});

async function usageOf(functionId: number) {
  const fn = await client.function.findUniqueOrThrow({
    where: { id: functionId },
    include: { _count: { select: { people: true, assignments: true, clientRates: true } } },
  });
  return fn._count;
}

describe("Function usage counts vs. canHardDeleteFunction, real DB", () => {
  it("an unused function is hard-deletable", async () => {
    const usage = await usageOf(ids.unused);
    expect(usage).toEqual({ people: 0, assignments: 0, clientRates: 0 });
    expect(canHardDeleteFunction(usage)).toBe(true);
    await expect(client.function.delete({ where: { id: ids.unused } })).resolves.toBeTruthy();
  });

  it("a function assigned to a person (PersonFunction) is not hard-deletable", async () => {
    const usage = await usageOf(ids.assignedToPerson);
    expect(usage.people).toBe(1);
    expect(canHardDeleteFunction(usage)).toBe(false);
    expect(functionDeleteBlockedMessage(usage)).toContain("1 persoon");
  });

  // The bug this whole task fixes: zero `people`, but a real booking.
  it("a function with zero people but a real PeriodPerson booking is not hard-deletable", async () => {
    const usage = await usageOf(ids.bookedOnly);
    expect(usage.people).toBe(0);
    expect(usage.assignments).toBe(1);
    expect(canHardDeleteFunction(usage)).toBe(false);
    expect(functionDeleteBlockedMessage(usage)).toContain("1 boeking");
  });

  it("a hard delete of a function still referenced by a booking would SetNull it — proving why the guard must block it", async () => {
    // Exercises the schema's actual onDelete behaviour directly (not via
    // the route, which must never reach this call for a used function) —
    // confirms `functionId` really does go to null rather than the FK
    // constraint blocking the delete outright, which is exactly the data
    // corruption canHardDeleteFunction exists to prevent.
    await client.function.delete({ where: { id: ids.bookedOnly } });
    const booking = await client.periodPerson.findFirstOrThrow({
      where: { personId: ids.person, periodId: ids.period },
    });
    expect(booking.functionId).toBeNull();
  });

  it("a function with a ClientFunctionRate is not hard-deletable", async () => {
    const usage = await usageOf(ids.clientRated);
    expect(usage.clientRates).toBe(1);
    expect(canHardDeleteFunction(usage)).toBe(false);
    expect(functionDeleteBlockedMessage(usage)).toContain("1 klanttarief");
  });
});

describe("archiving, real DB", () => {
  it("archiving a function hides it from the default (archived: false) query the GET route uses", async () => {
    const fn = await client.function.create({ data: { name: "Freelance klusjesman" } });
    let visible = await client.function.findMany({ where: { archived: false } });
    expect(visible.some((f) => f.id === fn.id)).toBe(true);

    await client.function.update({ where: { id: fn.id }, data: { archived: true } });
    visible = await client.function.findMany({ where: { archived: false } });
    expect(visible.some((f) => f.id === fn.id)).toBe(false);

    const all = await client.function.findMany({});
    expect(all.some((f) => f.id === fn.id && f.archived)).toBe(true);

    // Restoring (the manager dialog's "Herstellen") makes it visible again.
    await client.function.update({ where: { id: fn.id }, data: { archived: false } });
    visible = await client.function.findMany({ where: { archived: false } });
    expect(visible.some((f) => f.id === fn.id)).toBe(true);
  });
});
