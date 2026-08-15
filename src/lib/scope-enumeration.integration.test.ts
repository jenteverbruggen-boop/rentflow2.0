import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

vi.stubEnv("DATABASE_URL", `file:/tmp/scope-enumeration-init.db`);
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { execSync } from "child_process";
import os from "os";
import path from "path";
import fs from "fs";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "@/generated/prisma/client";
import { scopeFilter } from "@/lib/scope-filter";
import { projectInclude } from "@/lib/project-include";

/**
 * N5.4 — real-DB proof of the two requirements a mocked test can't
 * responsibly cover (own-data-scoping-design.md §7): a `scope: own`
 * user's null `personId` survives an actual Prisma round-trip without
 * a 500 or an unfiltered list, and an owned project's *every* period is
 * returned (not only the one the caller happens to be booked on) — the
 * design doc flags that second assertion as the one most likely to
 * regress into "only my periods" (§7).
 */

const DB_PATH = path.join(os.tmpdir(), `scope-enumeration-${process.pid}.db`);
const DB_URL = `file:${DB_PATH}`;

let client: PrismaClient;
const ids = { fredPerson: 0, projectOwned: 0, projectNotOwned: 0, periodBooked: 0, periodNotBooked: 0 };

beforeAll(async () => {
  execSync(`DATABASE_URL=${DB_URL} npx prisma db push --schema=prisma/schema.dev.prisma`, {
    stdio: "pipe",
  });

  const adapter = new PrismaLibSql({ url: DB_URL });
  client = new PrismaClient({ adapter } as never);

  const fred = await client.person.create({ data: { name: "Freelancer Fred", dayPrice: 250 } });
  ids.fredPerson = fred.id;

  const owned = await client.project.create({
    data: { name: "Project Fred is on", startDate: new Date("2026-09-01"), endDate: new Date("2026-09-10") },
  });
  ids.projectOwned = owned.id;

  const booked = await client.period.create({
    data: { projectId: owned.id, name: "Fred's period", startDate: new Date("2026-09-01T08:00:00Z"), endDate: new Date("2026-09-01T17:00:00Z") },
  });
  ids.periodBooked = booked.id;
  await client.periodPerson.create({ data: { periodId: booked.id, personId: fred.id, dayPriceSnapshot: 250 } });

  // A second period on the SAME project Fred is not personally booked
  // on — decided requirement 2: a scope:own caller sees every period of
  // an owned project, not only the one they're on.
  const notBooked = await client.period.create({
    data: { projectId: owned.id, name: "Someone else's period", startDate: new Date("2026-09-05T08:00:00Z"), endDate: new Date("2026-09-05T17:00:00Z") },
  });
  ids.periodNotBooked = notBooked.id;

  const notOwned = await client.project.create({
    data: { name: "Project Fred is not on", startDate: new Date("2026-09-01"), endDate: new Date("2026-09-10") },
  });
  ids.projectNotOwned = notOwned.id;
  await client.period.create({
    data: { projectId: notOwned.id, name: "Not Fred's period", startDate: new Date("2026-09-01T08:00:00Z"), endDate: new Date("2026-09-01T17:00:00Z") },
  });
}, 60_000);

afterAll(async () => {
  await client.$disconnect();
  fs.rmSync(DB_PATH, { force: true });
});

describe("scopeFilter against a real database (N5.4)", () => {
  it("a scope: own caller's project list contains only the project they're booked on", async () => {
    const where = scopeFilter({ scope: "own", personId: ids.fredPerson });
    const projects = await client.project.findMany({ where });
    expect(projects.map((p) => p.id)).toEqual([ids.projectOwned]);
  });

  it("the owned project's full period tree is returned — every period, not only the booked-on one", async () => {
    const where = scopeFilter({ scope: "own", personId: ids.fredPerson });
    const project = await client.project.findUnique({
      where: { ...where, id: ids.projectOwned },
      include: projectInclude,
    });
    expect(project).not.toBeNull();
    const periodIds = project!.periods.map((p) => p.id).sort();
    expect(periodIds).toEqual([ids.periodBooked, ids.periodNotBooked].sort());
  });

  it("a project the caller is not booked on resolves to null via the same findUnique — 404, never 403, one code path", async () => {
    const where = scopeFilter({ scope: "own", personId: ids.fredPerson });
    const project = await client.project.findUnique({
      where: { ...where, id: ids.projectNotOwned },
      include: projectInclude,
    });
    expect(project).toBeNull();
  });

  it("a scope: own caller with personId: null gets [] from a real Prisma round-trip, not a 500 or an unfiltered list", async () => {
    const where = scopeFilter({ scope: "own", personId: null });
    const projects = await client.project.findMany({ where });
    expect(projects).toEqual([]);
  });

  it("the same null-personId caller's findUnique on a real project id also resolves to null, not a crash", async () => {
    const where = scopeFilter({ scope: "own", personId: null });
    const project = await client.project.findUnique({
      where: { ...where, id: ids.projectOwned },
      include: projectInclude,
    });
    expect(project).toBeNull();
  });

  it("scope: all sees every project regardless of booking", async () => {
    const where = scopeFilter({ scope: "all", personId: ids.fredPerson });
    const projects = await client.project.findMany({ where });
    expect(projects.map((p) => p.id).sort()).toEqual(
      [ids.projectOwned, ids.projectNotOwned].sort(),
    );
  });
});
