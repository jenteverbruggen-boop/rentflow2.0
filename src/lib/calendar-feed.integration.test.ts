import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

vi.stubEnv("DATABASE_URL", `file:/tmp/calendar-feed-init.db`);
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { execSync } from "child_process";
import os from "os";
import path from "path";
import fs from "fs";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "@/generated/prisma/client";
import { prisma as mockedPrisma } from "@/lib/prisma";
import {
  resolveFeedToken,
  issueFeedToken,
  revokeFeedToken,
  revokeCompanyFeedForUser,
  revokeCompanyFeedsForRole,
  isCompanyFeedStillEligible,
} from "@/lib/calendar-feed";
import { buildPersonalFeedIcs, buildCompanyFeedIcs } from "@/lib/calendar-feed-ics";
import type { ResolvedAccess } from "@/lib/api-auth";

const DB_PATH = path.join(os.tmpdir(), `calendar-feed-${process.pid}.db`);
const DB_URL = `file:${DB_PATH}`;

let client: PrismaClient;
const ids = { allRole: 0, ownRole: 0, allUser: 0, ownUser: 0, linkedUser: 0, alice: 0, period: 0 };

beforeAll(async () => {
  execSync(`DATABASE_URL=${DB_URL} npx prisma db push --schema=prisma/schema.dev.prisma`, { stdio: "pipe" });
  const adapter = new PrismaLibSql({ url: DB_URL });
  client = new PrismaClient({ adapter } as never);
  Object.assign(mockedPrisma as object, client);

  const allRole = await client.role.create({
    data: { key: "ALL_ROLE", label: "All", scope: "all", permissions: { create: [{ module: "planning", access: "lezen" }] } },
  });
  const ownRole = await client.role.create({
    data: { key: "OWN_ROLE", label: "Own", scope: "own", permissions: { create: [{ module: "planning", access: "lezen" }] } },
  });
  ids.allRole = allRole.id;
  ids.ownRole = ownRole.id;

  const allUser = await client.user.create({
    data: { email: "all@test.dev", password: "x", name: "All User", roleId: allRole.id },
  });
  const ownUser = await client.user.create({
    data: { email: "own@test.dev", password: "x", name: "Own User", roleId: ownRole.id },
  });
  ids.allUser = allUser.id;
  ids.ownUser = ownUser.id;

  const alice = await client.person.create({ data: { name: "Alice", dayPrice: 300 } });
  ids.alice = alice.id;
  const linkedUser = await client.user.create({
    data: { email: "linked@test.dev", password: "x", name: "Linked User", roleId: allRole.id, personId: alice.id },
  });
  ids.linkedUser = linkedUser.id;

  const project = await client.project.create({
    data: { name: "Test Project", location: "Gent", startDate: new Date("2026-09-01"), endDate: new Date("2026-09-05") },
  });
  const period = await client.period.create({
    data: { projectId: project.id, name: "Opbouw", startDate: new Date("2026-09-01T08:00:00Z"), endDate: new Date("2026-09-01T18:00:00Z") },
  });
  ids.period = period.id;
  await client.periodPerson.create({ data: { periodId: period.id, personId: alice.id, dayPriceSnapshot: 300 } });
}, 60_000);

afterAll(async () => {
  await client.$disconnect();
  fs.rmSync(DB_PATH, { force: true });
});

function access(overrides: Partial<ResolvedAccess>): ResolvedAccess {
  return { id: ids.allUser, personId: null, scope: "all", permissions: { planning: "lezen" }, ...overrides };
}

describe("issueFeedToken (O1.4)", () => {
  it("issues a personal token for any caller", async () => {
    const result = await issueFeedToken(access({ id: ids.allUser }), "personal", client);
    expect("token" in result).toBe(true);
  });

  it("issues a company token for a scope: all caller with planning access", async () => {
    const result = await issueFeedToken(access({ id: ids.allUser, scope: "all" }), "company", client);
    expect("token" in result).toBe(true);
  });

  it("refuses a company token for a scope: own caller (O1.3)", async () => {
    const result = await issueFeedToken(access({ id: ids.ownUser, scope: "own" }), "company", client);
    expect("error" in result).toBe(true);
  });

  it("refuses a company token without planning access", async () => {
    const result = await issueFeedToken(
      access({ id: ids.allUser, scope: "all", permissions: { planning: "geen" } }),
      "company",
      client,
    );
    expect("error" in result).toBe(true);
  });

  it("reissuing replaces the old token — the old one no longer resolves", async () => {
    const first = await issueFeedToken(access({ id: ids.allUser }), "personal", client);
    if (!("token" in first)) throw new Error("expected token");
    const second = await issueFeedToken(access({ id: ids.allUser }), "personal", client);
    if (!("token" in second)) throw new Error("expected token");

    expect(first.token).not.toBe(second.token);
    expect(await resolveFeedToken(first.token, client)).toBeNull();
    expect(await resolveFeedToken(second.token, client)).not.toBeNull();
  });
});

describe("revokeFeedToken", () => {
  it("revokes only the caller's own feed, not another user's", async () => {
    const issued = await issueFeedToken(access({ id: ids.allUser }), "personal", client);
    if (!("token" in issued)) throw new Error("expected token");
    const feed = await client.calendarFeed.findUniqueOrThrow({ where: { token: issued.token } });

    expect(await revokeFeedToken(ids.ownUser, feed.id, client)).toBe(false);
    expect(await resolveFeedToken(issued.token, client)).not.toBeNull();

    expect(await revokeFeedToken(ids.allUser, feed.id, client)).toBe(true);
    expect(await resolveFeedToken(issued.token, client)).toBeNull();
  });
});

describe("revocation on role/scope change (O1.3)", () => {
  it("revokeCompanyFeedForUser removes only the company-kind feed", async () => {
    const company = await issueFeedToken(access({ id: ids.linkedUser }), "company", client);
    const personal = await issueFeedToken(access({ id: ids.linkedUser }), "personal", client);
    if (!("token" in company) || !("token" in personal)) throw new Error("expected tokens");

    await revokeCompanyFeedForUser(ids.linkedUser, client);
    expect(await resolveFeedToken(company.token, client)).toBeNull();
    expect(await resolveFeedToken(personal.token, client)).not.toBeNull();
  });

  it("revokeCompanyFeedsForRole removes every company feed for users on that role", async () => {
    const issued = await issueFeedToken(access({ id: ids.allUser, scope: "all" }), "company", client);
    if (!("token" in issued)) throw new Error("expected token");

    await revokeCompanyFeedsForRole(ids.allRole, client);
    expect(await resolveFeedToken(issued.token, client)).toBeNull();
  });
});

describe("buildPersonalFeedIcs (O1.2)", () => {
  it("renders one VEVENT per booking using the assignment's real times", async () => {
    const ics = await buildPersonalFeedIcs(ids.linkedUser, new Date("2026-08-14T09:00:00Z"), client);
    expect(ics).toContain(`UID:period-${ids.period}@rentflow.app`);
    expect(ics).toContain("DTSTART:20260901T080000Z");
    expect(ics).toContain("DTEND:20260901T180000Z");
    expect(ics).toContain("LOCATION:Gent");
  });

  it("a user with no linked person gets a single explanatory event, not a blank file", async () => {
    const ics = await buildPersonalFeedIcs(ids.allUser, new Date("2026-08-14T09:00:00Z"), client);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1);
    expect(ics).toContain("geen personeelsprofiel gekoppeld");
  });
});

describe("buildCompanyFeedIcs (O1.3)", () => {
  it("includes every period, unfiltered by ownership", async () => {
    const ics = await buildCompanyFeedIcs(new Date("2026-08-14T09:00:00Z"), client);
    expect(ics).toContain(`UID:period-${ids.period}@rentflow.app`);
  });
});

describe("isCompanyFeedStillEligible (review finding — per-request re-check)", () => {
  it("is eligible for a scope: all user with planning access", async () => {
    expect(await isCompanyFeedStillEligible(ids.allUser, client)).toBe(true);
  });

  it("is not eligible for a scope: own user, even with planning access", async () => {
    expect(await isCompanyFeedStillEligible(ids.ownUser, client)).toBe(false);
  });

  it("catches a pure planning-permission downgrade — no roleId/scope change, only the matrix", async () => {
    const role = await client.role.create({
      data: { key: "DOWNGRADE_TEST", label: "Downgrade Test", scope: "all", permissions: { create: [{ module: "planning", access: "lezen" }] } },
    });
    const user = await client.user.create({ data: { email: "downgrade@test.dev", password: "x", name: "Downgrade User", roleId: role.id } });
    expect(await isCompanyFeedStillEligible(user.id, client)).toBe(true);

    await client.rolePermission.update({
      where: { roleId_module: { roleId: role.id, module: "planning" } },
      data: { access: "geen" },
    });
    expect(await isCompanyFeedStillEligible(user.id, client)).toBe(false);
  });

  it("returns false for a nonexistent user rather than throwing", async () => {
    expect(await isCompanyFeedStillEligible(999999, client)).toBe(false);
  });
});
