import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

vi.stubEnv("DATABASE_URL", `file:/tmp/user-theme-init.db`);
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { execSync } from "child_process";
import os from "os";
import path from "path";
import fs from "fs";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "@/generated/prisma/client";
import { prisma as mockedPrisma } from "@/lib/prisma";
import { getUserTheme, setUserTheme } from "@/lib/user-theme";

const DB_PATH = path.join(os.tmpdir(), `user-theme-${process.pid}.db`);
let client: PrismaClient;
let alice = 0;
let bob = 0;

beforeAll(async () => {
  execSync(`DATABASE_URL=file:${DB_PATH} npx prisma db push --schema=prisma/schema.dev.prisma`, { stdio: "pipe" });
  client = new PrismaClient({ adapter: new PrismaLibSql({ url: `file:${DB_PATH}` }) } as never);
  Object.assign(mockedPrisma as object, client);
  const role = await client.role.create({ data: { key: "THEME_TEST", label: "Theme test", scope: "all" } });
  alice = (await client.user.create({ data: { email: "a@t.dev", password: "x", name: "A", roleId: role.id } })).id;
  bob = (await client.user.create({ data: { email: "b@t.dev", password: "x", name: "B", roleId: role.id } })).id;
}, 60_000);

afterAll(async () => {
  await client.$disconnect();
  fs.rmSync(DB_PATH, { force: true });
});

describe("account theme", () => {
  it("a new account is dark, and the choice is remembered per account", async () => {
    expect(await getUserTheme(alice)).toBe("dark");
    expect(await setUserTheme(alice, "light")).toBe("light");
    expect(await getUserTheme(alice)).toBe("light");
    expect(await getUserTheme(bob)).toBe("dark"); // someone else's preference is untouched
  });

  it("an unknown stored value reads as the default instead of breaking the UI", async () => {
    await client.user.update({ where: { id: bob }, data: { theme: "neon" } });
    expect(await getUserTheme(bob)).toBe("dark");
  });
});
