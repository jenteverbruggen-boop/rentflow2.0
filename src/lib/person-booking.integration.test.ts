import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

vi.stubEnv("DATABASE_URL", `file:/tmp/person-booking-init.db`);
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { execSync } from "child_process";
import os from "os";
import path from "path";
import fs from "fs";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "@/generated/prisma/client";
import { checkPersonAvailability } from "@/lib/availability";
import { bookPersonAssignment } from "@/lib/person-booking";

const DB_PATH = path.join(os.tmpdir(), `person-booking-${process.pid}.db`);
const DB_URL = `file:${DB_PATH}`;

let client: PrismaClient;
const ids = { person: 0, projectA: 0, projectB: 0, fullDayPeriod: 0 };

beforeAll(async () => {
  execSync(`DATABASE_URL=${DB_URL} npx prisma db push --schema=prisma/schema.dev.prisma`, {
    stdio: "pipe",
  });
  const adapter = new PrismaLibSql({ url: DB_URL });
  client = new PrismaClient({ adapter } as never);

  const person = await client.person.create({ data: { name: "Bob", dayPrice: 300 } });
  ids.person = person.id;

  const projectA = await client.project.create({
    data: { name: "Project A", startDate: new Date("2026-09-01"), endDate: new Date("2026-09-01") },
  });
  ids.projectA = projectA.id;
  const projectB = await client.project.create({
    data: { name: "Project B", startDate: new Date("2026-09-01"), endDate: new Date("2026-09-01") },
  });
  ids.projectB = projectB.id;

  // A full-day period (00:00-23:59) that Bob is only actually booked on
  // for the evening — the "narrower window frees the rest of the day"
  // case H1.3 exists for.
  const fullDayPeriod = await client.period.create({
    data: {
      projectId: projectA.id,
      name: "Full day",
      startDate: new Date("2026-09-01T00:00:00Z"),
      endDate: new Date("2026-09-01T23:59:00Z"),
    },
  });
  ids.fullDayPeriod = fullDayPeriod.id;
  await client.periodPerson.create({
    data: {
      periodId: fullDayPeriod.id,
      personId: person.id,
      startAt: new Date("2026-09-01T18:00:00Z"),
      endAt: new Date("2026-09-01T23:00:00Z"),
      dayPriceSnapshot: 300,
    },
  });
}, 60_000);

afterAll(async () => {
  await client.$disconnect();
  fs.rmSync(DB_PATH, { force: true });
});

describe("checkPersonAvailability against assignment windows, real DB (H1.4)", () => {
  it("a window narrower than the period frees the rest of the day — the reason H1 exists", async () => {
    const result = await checkPersonAvailability(
      ids.person,
      { from: new Date("2026-09-01T08:00:00Z"), to: new Date("2026-09-01T17:00:00Z") },
      client,
    );
    expect(result.blockingProject).toBeUndefined();
  });

  it("touching the assignment's exact boundary does not conflict", async () => {
    const result = await checkPersonAvailability(
      ids.person,
      { from: new Date("2026-09-01T23:00:00Z"), to: new Date("2026-09-02T09:00:00Z") },
      client,
    );
    expect(result.blockingProject).toBeUndefined();
  });

  it("a 1-minute overlap with the assignment's own window conflicts", async () => {
    const result = await checkPersonAvailability(
      ids.person,
      { from: new Date("2026-09-01T22:59:00Z"), to: new Date("2026-09-02T09:00:00Z") },
      client,
    );
    expect(result.blockingProject?.name).toBe("Project A");
  });

  it("a query fully inside the assignment's own window conflicts", async () => {
    const result = await checkPersonAvailability(
      ids.person,
      { from: new Date("2026-09-01T19:00:00Z"), to: new Date("2026-09-01T20:00:00Z") },
      client,
    );
    expect(result.blockingProject?.name).toBe("Project A");
  });
});

describe("bookPersonAssignment — explicit double-booking override (H2.1)", () => {
  it("refuses an overlapping booking without allowOverlap, naming the conflicting project", async () => {
    const projectC = await client.project.create({
      data: { name: "Project C", startDate: new Date("2026-09-01"), endDate: new Date("2026-09-01") },
    });
    const period = await client.period.create({
      data: {
        projectId: projectC.id,
        name: "Evening gig",
        startDate: new Date("2026-09-01T19:00:00Z"),
        endDate: new Date("2026-09-01T22:00:00Z"),
      },
    });

    await expect(
      bookPersonAssignment({
        periodId: period.id,
        personId: ids.person,
        personName: "Bob",
        role: null,
        functionId: null,
        dayPriceSnapshot: 300,
        discountPct: null,
        discountAmount: null,
        from: period.startDate,
        to: period.endDate,
        excludePeriodId: period.id,
        sameProjectId: projectC.id,
        client,
      }),
    ).rejects.toMatchObject({
      code: "BLOCKED",
      blockingProject: { name: "Project A" },
    });

    const rows = await client.periodPerson.findMany({ where: { periodId: period.id } });
    expect(rows).toHaveLength(0);
  });

  it("with allowOverlap: true, the same booking succeeds and persists overlapAck: true", async () => {
    const projectC = await client.project.create({
      data: { name: "Project D", startDate: new Date("2026-09-01"), endDate: new Date("2026-09-01") },
    });
    const period = await client.period.create({
      data: {
        projectId: projectC.id,
        name: "Evening gig 2",
        startDate: new Date("2026-09-01T19:00:00Z"),
        endDate: new Date("2026-09-01T22:00:00Z"),
      },
    });

    const { assignment } = await bookPersonAssignment({
      periodId: period.id,
      personId: ids.person,
      personName: "Bob",
      role: null,
      functionId: null,
      dayPriceSnapshot: 300,
      discountPct: null,
      discountAmount: null,
      from: period.startDate,
      to: period.endDate,
      excludePeriodId: period.id,
      sameProjectId: projectC.id,
      allowOverlap: true,
      client,
    });

    expect(assignment.overlapAck).toBe(true);
  });
});

describe("bookPersonAssignment — transactional race protection (H1.4)", () => {
  it("two concurrent bookings of the same person on the same period: exactly one succeeds", async () => {
    const period = await client.period.create({
      data: {
        projectId: ids.projectB,
        name: "Race period",
        startDate: new Date("2026-10-01T08:00:00Z"),
        endDate: new Date("2026-10-01T17:00:00Z"),
      },
    });
    const racer = await client.person.create({ data: { name: "Racer", dayPrice: 200 } });

    const bookOnce = () =>
      bookPersonAssignment({
        periodId: period.id,
        personId: racer.id,
        personName: racer.name,
        role: null,
        functionId: null,
        dayPriceSnapshot: 200,
        discountPct: null,
        discountAmount: null,
        from: period.startDate,
        to: period.endDate,
        excludePeriodId: period.id,
        sameProjectId: ids.projectB,
        client,
      });

    const results = await Promise.allSettled([bookOnce(), bookOnce()]);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const rows = await client.periodPerson.findMany({
      where: { periodId: period.id, personId: racer.id },
    });
    expect(rows).toHaveLength(1);
  });
});
