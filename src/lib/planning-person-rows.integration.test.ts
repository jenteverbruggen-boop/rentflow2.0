import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

vi.stubEnv("DATABASE_URL", `file:/tmp/planning-person-rows-init.db`);
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { execSync } from "child_process";
import os from "os";
import path from "path";
import fs from "fs";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "@/generated/prisma/client";
import { prisma as mockedPrisma } from "@/lib/prisma";
import { fetchPlanningPersonRows } from "@/lib/planning-person-rows";
import type { ScopeAccess } from "@/lib/scope-filter";

const DB_PATH = path.join(os.tmpdir(), `planning-person-rows-${process.pid}.db`);
const DB_URL = `file:${DB_PATH}`;

let client: PrismaClient;
const ids = { alice: 0, bob: 0 };

beforeAll(async () => {
  execSync(`DATABASE_URL=${DB_URL} npx prisma db push --schema=prisma/schema.dev.prisma`, { stdio: "pipe" });
  const adapter = new PrismaLibSql({ url: DB_URL });
  client = new PrismaClient({ adapter } as never);
  Object.assign(mockedPrisma as object, client);

  const alice = await client.person.create({ data: { name: "Alice", dayPrice: 300 } });
  const bob = await client.person.create({ data: { name: "Bob", dayPrice: 300 } });
  ids.alice = alice.id;
  ids.bob = bob.id;

  const project = await client.project.create({
    data: { name: "Test Project", startDate: new Date("2026-06-01"), endDate: new Date("2026-06-10") },
  });
  const period = await client.period.create({
    data: { projectId: project.id, name: "Event", startDate: new Date("2026-06-05"), endDate: new Date("2026-06-05") },
  });
  await client.periodPerson.create({
    data: { periodId: period.id, personId: alice.id, dayPriceSnapshot: 300, overlapAck: true },
  });
  await client.periodPerson.create({
    data: { periodId: period.id, personId: bob.id, dayPriceSnapshot: 300 },
  });
}, 60_000);

afterAll(async () => {
  await client.$disconnect();
  fs.rmSync(DB_PATH, { force: true });
});

const range = { from: new Date("2026-06-01"), to: new Date("2026-06-30") };

describe("fetchPlanningPersonRows (I3.1/I3.2)", () => {
  it("returns one row per person, sorted by name", async () => {
    const rows = await fetchPlanningPersonRows({ scope: "all", personId: null }, range, client);
    expect(rows.map((r) => r.name)).toEqual(["Alice", "Bob"]);
    expect(rows[0].bookings).toHaveLength(1);
  });

  it("flags a forced double booking via overlapAck (I3.2)", async () => {
    const rows = await fetchPlanningPersonRows({ scope: "all", personId: null }, range, client);
    const alice = rows.find((r) => r.personId === ids.alice)!;
    expect(alice.bookings[0].overlapAck).toBe(true);
    const bob = rows.find((r) => r.personId === ids.bob)!;
    expect(bob.bookings[0].overlapAck).toBe(false);
  });

  it("scope: own sees only their own row", async () => {
    const scoped: ScopeAccess = { scope: "own", personId: ids.bob };
    const rows = await fetchPlanningPersonRows(scoped, range, client);
    expect(rows).toHaveLength(1);
    expect(rows[0].personId).toBe(ids.bob);
  });

  it("scope: own with no linked person sees nothing, never everyone", async () => {
    const scoped: ScopeAccess = { scope: "own", personId: null };
    const rows = await fetchPlanningPersonRows(scoped, range, client);
    expect(rows).toHaveLength(0);
  });
});
