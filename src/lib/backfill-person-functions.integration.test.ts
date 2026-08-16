import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execSync } from "child_process";
import os from "os";
import path from "path";
import fs from "fs";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "@/generated/prisma/client";
import { backfillPersonFunctions } from "./backfill-person-functions";

const DB_PATH = path.join(os.tmpdir(), `backfill-person-functions-${process.pid}.db`);
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

describe("backfillPersonFunctions (L4.1)", () => {
  it("creates a PersonFunction row for an exact role/Function.name match, logs anything that doesn't match", async () => {
    const electrician = await client.function.create({ data: { name: "Electrician" } });
    const person = await client.person.create({ data: { name: "Bob", role: "Electrician", dayPrice: 300 } });
    const mismatched = await client.person.create({ data: { name: "Sparky Guy", role: "Sparky", dayPrice: 300 } });

    const result = await backfillPersonFunctions(client);

    expect(result.matched).toBe(1);
    expect(result.unmatched).toEqual([{ id: mismatched.id, name: "Sparky Guy", role: "Sparky" }]);

    const linked = await client.personFunction.findUnique({
      where: { personId_functionId: { personId: person.id, functionId: electrician.id } },
    });
    expect(linked).not.toBeNull();
    const stillUnlinked = await client.personFunction.findMany({ where: { personId: mismatched.id } });
    expect(stillUnlinked).toHaveLength(0);
  });

  it("never duplicates a link that already exists", async () => {
    const carpenter = await client.function.create({ data: { name: "Carpenter" } });
    const person = await client.person.create({ data: { name: "Charlie", role: "Carpenter", dayPrice: 250 } });
    await client.personFunction.create({ data: { personId: person.id, functionId: carpenter.id } });

    await backfillPersonFunctions(client);

    // Scoped to this person — other tests in this shared DB accumulate
    // their own already-linked rows across runs, so an aggregate result
    // count isn't a reliable assertion here.
    const links = await client.personFunction.findMany({ where: { personId: person.id } });
    expect(links).toHaveLength(1);
  });

  it("skips a person with no role at all", async () => {
    await client.person.create({ data: { name: "No Role Nora", dayPrice: 200 } });
    const result = await backfillPersonFunctions(client);
    expect(result.unmatched.find((u) => u.name === "No Role Nora")).toBeUndefined();
  });
});
