import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

vi.stubEnv("DATABASE_URL", `file:/tmp/person-link-suggestions-init.db`);
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { execSync } from "child_process";
import os from "os";
import path from "path";
import fs from "fs";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "@/generated/prisma/client";
import { prisma as mockedPrisma } from "@/lib/prisma";
import { findPersonLinkSuggestions } from "@/lib/person-link-suggestions";

const DB_PATH = path.join(os.tmpdir(), `person-link-suggestions-${process.pid}.db`);
const DB_URL = `file:${DB_PATH}`;

let client: PrismaClient;
let roleId = 0;

beforeAll(async () => {
  execSync(`DATABASE_URL=${DB_URL} npx prisma db push --schema=prisma/schema.dev.prisma`, { stdio: "pipe" });
  client = new PrismaClient({ adapter: new PrismaLibSql({ url: DB_URL }) } as never);
  Object.assign(mockedPrisma as object, client);
  const role = await client.role.create({ data: { key: "R", label: "R", scope: "all" } });
  roleId = role.id;
}, 60_000);

afterAll(async () => {
  await client.$disconnect();
  fs.rmSync(DB_PATH, { force: true });
});

async function reset() {
  await client.user.deleteMany();
  await client.person.deleteMany();
}

const user = (email: string, name = "U") =>
  client.user.create({ data: { email, password: "x", name, roleId } });

describe("findPersonLinkSuggestions", () => {
  it("matches an unlinked user to an unlinked person on e-mail, ignoring case", async () => {
    await reset();
    await user("Jente.Verbruggen@Example.org", "Jente");
    const person = await client.person.create({
      data: { name: "Jente Verbruggen", email: "jente.verbruggen@example.org", dayPrice: 0 },
    });

    const suggestions = await findPersonLinkSuggestions(client);
    expect(suggestions).toEqual([
      expect.objectContaining({ personId: person.id, personName: "Jente Verbruggen" }),
    ]);
  });

  it("never suggests on name alone — two people can share a name", async () => {
    await reset();
    await user("marc@example.org", "Marc Maes");
    await client.person.create({ data: { name: "Marc Maes", dayPrice: 0 } });

    expect(await findPersonLinkSuggestions(client)).toEqual([]);
  });

  it("skips a person who already has a user account", async () => {
    await reset();
    const person = await client.person.create({
      data: { name: "Linked", email: "linked@example.org", dayPrice: 0 },
    });
    await client.user.create({
      data: { email: "other@example.org", password: "x", name: "Other", roleId, personId: person.id },
    });
    await user("linked@example.org", "Wants The Same Person");

    expect(await findPersonLinkSuggestions(client)).toEqual([]);
  });

  it("skips a user who is already linked", async () => {
    await reset();
    const person = await client.person.create({
      data: { name: "Someone Else", email: "shared@example.org", dayPrice: 0 },
    });
    const own = await client.person.create({ data: { name: "Own", dayPrice: 0 } });
    await client.user.create({
      data: { email: "shared@example.org", password: "x", name: "U", roleId, personId: own.id },
    });

    const suggestions = await findPersonLinkSuggestions(client);
    expect(suggestions.find((s) => s.personId === person.id)).toBeUndefined();
  });

  it("refuses an ambiguous address — a shared mailbox on two people", async () => {
    await reset();
    await user("info@example.org");
    await client.person.create({ data: { name: "A", email: "info@example.org", dayPrice: 0 } });
    await client.person.create({ data: { name: "B", email: "info@example.org", dayPrice: 0 } });

    expect(await findPersonLinkSuggestions(client)).toEqual([]);
  });

  it("refuses an ambiguous address — two unlinked users on one person", async () => {
    await reset();
    await user("info@example.org", "One");
    await user("INFO@example.org", "Two");
    await client.person.create({ data: { name: "A", email: "info@example.org", dayPrice: 0 } });

    expect(await findPersonLinkSuggestions(client)).toEqual([]);
  });

  it("ignores people with no e-mail at all", async () => {
    await reset();
    await user("someone@example.org");
    await client.person.create({ data: { name: "No Mail", email: "", dayPrice: 0 } });
    await client.person.create({ data: { name: "Null Mail", dayPrice: 0 } });

    expect(await findPersonLinkSuggestions(client)).toEqual([]);
  });
});
