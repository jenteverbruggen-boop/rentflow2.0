import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

vi.stubEnv("DATABASE_URL", `file:/tmp/money-write-guard-integration-init.db`);
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { execSync } from "child_process";
import os from "os";
import path from "path";
import fs from "fs";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "@/generated/prisma/client";
import type { ResolvedAccess } from "@/lib/api-auth";
import { findRejectedMoneyWrite, moneyFieldsToIgnore } from "@/lib/money-write-guard";
import { findRejectedFunctionRate, personFunctionRateData } from "@/lib/person-function-rate-guard";

/**
 * Integration coverage for the money-blind write bug this task fixes,
 * against a real Prisma/SQLite DB — same convention as the other
 * `*.integration.test.ts` files. Each test drives the exact same
 * guard + write-shaping helpers PUT /api/people/[id] calls, then reads
 * the row back from the DB to prove what actually persisted, not just
 * what the helper functions returned in isolation (money-write-guard.test.ts
 * and person-function-rate-guard.test.ts already cover those in unit
 * form). The full route wiring itself is proven by the manual curl
 * repro in the PR description, since route handlers here aren't
 * unit-callable outside the Next.js request runtime.
 */
const DB_PATH = path.join(os.tmpdir(), `money-write-guard-integration-${process.pid}.db`);
const DB_URL = `file:${DB_PATH}`;

let client: PrismaClient;
let personId: number;
let functionId: number;

function access(kostenLevel: string, scope: ResolvedAccess["scope"] = "all"): ResolvedAccess {
  return { id: 1, personId: null, scope, permissions: { kosten_facturen: kostenLevel as never } };
}

// Mirrors PUT /api/people/[id]'s own data-shaping: omit dayPrice
// entirely when the caller's money-blind, otherwise write it (already
// guard-checked by the caller of this helper).
async function saveDayPrice(id: number, submittedDayPrice: number, callerAccess: ResolvedAccess) {
  const ignore = moneyFieldsToIgnore(callerAccess, ["dayPrice"]);
  await client.person.update({
    where: { id },
    data: {
      name: "Alice Vermeersch (bijgewerkt)",
      ...(ignore.has("dayPrice") ? {} : { dayPrice: submittedDayPrice }),
    },
  });
}

beforeAll(async () => {
  execSync(`DATABASE_URL=${DB_URL} npx prisma db push --schema=prisma/schema.dev.prisma`, {
    stdio: "pipe",
  });
  const adapter = new PrismaLibSql({ url: DB_URL });
  client = new PrismaClient({ adapter } as never);

  const fn = await client.function.create({ data: { name: "Rigger", dayRate: 100 } });
  functionId = fn.id;
  const person = await client.person.create({ data: { name: "Alice Vermeersch", dayPrice: 450 } });
  personId = person.id;
  await client.personFunction.create({
    data: { personId, functionId, dayRate: 75, hourRate: null },
  });
}, 60_000);

afterAll(async () => {
  await client.$disconnect();
  fs.rmSync(DB_PATH, { force: true });
});

describe("money-blind caller saving a person (the exact bug reproduced against a real DB)", () => {
  it("(a) saves a non-money edit successfully and leaves the persisted dayPrice unchanged", async () => {
    const callerAccess = access("geen");
    // The redacted GET response's dayPrice (null) round-trips through
    // PersonForm's `?? 0` default — this is what actually gets submitted.
    const submitted = 0;

    expect(findRejectedMoneyWrite({ dayPrice: submitted }, callerAccess, { dayPrice: 450 })).toBeNull();
    await saveDayPrice(personId, submitted, callerAccess);

    const row = await client.person.findUniqueOrThrow({ where: { id: personId } });
    expect(row.name).toBe("Alice Vermeersch (bijgewerkt)");
    expect(Number(row.dayPrice)).toBe(450);
  });

  it("(b) the money-blind caller's submitted dayPrice is never written, even a large one", async () => {
    const callerAccess = access("geen");
    expect(findRejectedMoneyWrite({ dayPrice: 99999 }, callerAccess, { dayPrice: 450 })).toBeNull();
    await saveDayPrice(personId, 99999, callerAccess);

    const row = await client.person.findUniqueOrThrow({ where: { id: personId } });
    expect(Number(row.dayPrice)).toBe(450);
  });

  it("(e) a money-blind caller's redacted-to-null PersonFunction rate does not wipe the real override", async () => {
    const callerAccess = access("geen");
    const current = new Map([[functionId, { dayRate: 75, hourRate: null }]]);
    expect(
      findRejectedFunctionRate([{ functionId, dayRate: null, hourRate: null }], callerAccess, current),
    ).toBeNull();

    const rateData = personFunctionRateData({ functionId, dayRate: null, hourRate: null }, callerAccess);
    expect(rateData).toEqual({});
    // The route's own guard: an empty data object means "skip the
    // update call entirely" — asserted here, not executed, since an
    // empty `data: {}` update is itself a no-op in Prisma.
    if (Object.keys(rateData).length > 0) {
      await client.personFunction.update({
        where: { personId_functionId: { personId, functionId } },
        data: rateData,
      });
    }

    const row = await client.personFunction.findUniqueOrThrow({
      where: { personId_functionId: { personId, functionId } },
    });
    expect(Number(row.dayRate)).toBe(75);
  });
});

describe("money-visible-but-not-writable caller (Kosten/Facturen: lezen only)", () => {
  it("(c) can save an unchanged dayPrice echo", async () => {
    const callerAccess = access("lezen");
    expect(findRejectedMoneyWrite({ dayPrice: 450 }, callerAccess, { dayPrice: 450 })).toBeNull();
    await saveDayPrice(personId, 450, callerAccess);

    const row = await client.person.findUniqueOrThrow({ where: { id: personId } });
    expect(Number(row.dayPrice)).toBe(450);
  });

  it("(d) is still rejected on a genuine dayPrice change, and the persisted value is untouched", async () => {
    const callerAccess = access("lezen");
    const rejected = findRejectedMoneyWrite({ dayPrice: 999 }, callerAccess, { dayPrice: 450 });
    expect(rejected).toBe("dayPrice");
    // The route returns 403 before ever calling prisma.person.update —
    // asserted here by simply not writing, then confirming no drift.

    const row = await client.person.findUniqueOrThrow({ where: { id: personId } });
    expect(Number(row.dayPrice)).toBe(450);
  });
});
