import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

vi.stubEnv("DATABASE_URL", `file:/tmp/fetch-projects-init.db`);
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { execSync } from "child_process";
import os from "os";
import path from "path";
import fs from "fs";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "@/generated/prisma/client";
import { prisma as mockedPrisma } from "@/lib/prisma";
import { fetchProjects } from "@/lib/fetch-projects";
import type { ResolvedAccess } from "@/lib/api-auth";

const DB_PATH = path.join(os.tmpdir(), `fetch-projects-${process.pid}.db`);
const DB_URL = `file:${DB_PATH}`;

let client: PrismaClient;
const ids = { juneProject: 0, julyProject: 0, person: 0 };
const access: ResolvedAccess = { id: 1, personId: null, scope: "all", permissions: {} };

beforeAll(async () => {
  execSync(`DATABASE_URL=${DB_URL} npx prisma db push --schema=prisma/schema.dev.prisma`, { stdio: "pipe" });
  const adapter = new PrismaLibSql({ url: DB_URL });
  client = new PrismaClient({ adapter } as never);
  Object.assign(mockedPrisma as object, client);

  const person = await client.person.create({ data: { name: "Jan Peeters", dayPrice: 200 } });
  ids.person = person.id;

  const june = await client.project.create({
    data: {
      name: "June Project", startDate: new Date("2026-06-01"), endDate: new Date("2026-06-30"),
      periods: {
        create: [{
          name: "Event", startDate: new Date("2026-06-15T18:00:00Z"), endDate: new Date("2026-06-15T23:00:00Z"),
          people: { create: [{ personId: person.id, dayPriceSnapshot: 200 }] },
        }],
      },
    },
  });
  ids.juneProject = june.id;

  const july = await client.project.create({
    data: { name: "July Project", startDate: new Date("2026-07-01"), endDate: new Date("2026-07-10") },
  });
  ids.julyProject = july.id;
}, 60_000);

afterAll(async () => {
  await client.$disconnect();
  fs.rmSync(DB_PATH, { force: true });
});

describe("fetchProjects (I2.1)", () => {
  it("with no range, returns the full unfiltered tree (regression: unchanged shape)", async () => {
    const projects = await fetchProjects(access, undefined, client);
    expect(projects).toHaveLength(2);
    const june = projects.find((p) => p.id === ids.juneProject)!;
    expect(june.periods[0].people).toHaveLength(1); // full nested person array, not a count
  });

  it("with a range, returns only projects overlapping it, in the lean planning shape", async () => {
    const projects = await fetchProjects(access, { from: new Date("2026-06-01"), to: new Date("2026-06-30") }, client);
    expect(projects).toHaveLength(1);
    const [june] = projects;
    expect(june.name).toBe("June Project");
    expect(june.periods[0].peopleCount).toBe(1); // a count, not a nested array
    expect(june.periods[0]).not.toHaveProperty("people");
  });

  it("a period's real times survive into the lean shape (I2.2 needs HH:mm)", async () => {
    const projects = await fetchProjects(access, { from: new Date("2026-06-01"), to: new Date("2026-06-30") }, client);
    const period = projects[0].periods[0];
    expect(period.startDate).toContain("18:00");
    expect(period.endDate).toContain("23:00");
  });

  it("excludes a project outside the requested range", async () => {
    const projects = await fetchProjects(access, { from: new Date("2026-06-01"), to: new Date("2026-06-30") }, client);
    expect(projects.find((p) => p.name === "July Project")).toBeUndefined();
  });
});
