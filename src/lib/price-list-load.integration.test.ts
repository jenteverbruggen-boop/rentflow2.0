import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

vi.stubEnv("DATABASE_URL", `file:/tmp/price-list-load-init.db`);
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { execSync } from "child_process";
import os from "os";
import path from "path";
import fs from "fs";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "@/generated/prisma/client";
import { loadPriceList } from "@/lib/price-list-load";
import { DEFAULT_PRICE_LIST_OPTIONS } from "@/lib/price-list";

const DB_PATH = path.join(os.tmpdir(), `price-list-load-${process.pid}.db`);
const DB_URL = `file:${DB_PATH}`;

let client: PrismaClient;
let clientId: number;

beforeAll(async () => {
  execSync(`DATABASE_URL=${DB_URL} npx prisma db push --schema=prisma/schema.dev.prisma`, { stdio: "pipe" });
  client = new PrismaClient({ adapter: new PrismaLibSql({ url: DB_URL }) } as never);

  const cat = await client.category.create({ data: { name: "Tenten", prefix: "TEN" } });
  const tent = await client.material.create({ data: { name: "Tent 6x3", categoryId: cat.id, dayPrice: 80, setupCost: 25 } });
  await client.material.create({ data: { name: "Oude tent", categoryId: cat.id, dayPrice: 60, archived: true } });
  // A zero-stock "inhuur" item: it still has a price and must be listed.
  await client.material.create({ data: { name: "Bord (inhuur)", dayPrice: 0.5 } });
  const archivedChild = await client.material.create({ data: { name: "Oude paal", dayPrice: 5, archived: true } });
  const set = await client.material.create({ data: { name: "Tentset", isBundle: true, categoryId: cat.id } });
  await client.materialComponent.createMany({
    data: [
      { parentId: set.id, childId: tent.id, quantity: 1 },
      { parentId: set.id, childId: archivedChild.id, quantity: 4 },
    ],
  });

  const tech = await client.function.create({ data: { name: "Technicus", dayRate: 300, hourRate: 40 } });
  await client.function.create({ data: { name: "Oude functie", dayRate: 100, archived: true } });
  const c = await client.client.create({ data: { name: "Festival X" } });
  clientId = c.id;
  await client.clientFunctionRate.create({ data: { clientId, functionId: tech.id, dayRate: 350 } });
}, 60_000);

afterAll(async () => {
  await client.$disconnect();
  fs.rmSync(DB_PATH, { force: true });
});

describe("loadPriceList (C6)", () => {
  it("lists active materials incl. zero-stock inhuur items, never archived ones", async () => {
    const list = await loadPriceList(DEFAULT_PRICE_LIST_OPTIONS, client);
    const names = list.sections.flatMap((s) => s.rows.map((r) => r.name));
    expect(names).toContain("Tent 6x3");
    expect(names).toContain("Bord (inhuur)");
    expect(names).not.toContain("Oude tent");
  });

  it("prices a set from all its components, archived ones included (as booking does)", async () => {
    const list = await loadPriceList(DEFAULT_PRICE_LIST_OPTIONS, client);
    const set = list.sections.flatMap((s) => s.rows).find((r) => r.name === "Tentset")!;
    expect(set.dayPrice).toBe(80 + 4 * 5);
    expect(set.isSet).toBe(true);
  });

  it("includes crew with the chosen client's card, skipping archived functions", async () => {
    const list = await loadPriceList({ ...DEFAULT_PRICE_LIST_OPTIONS, includeCrew: true, clientId }, client);
    expect(list.clientName).toBe("Festival X");
    expect(list.crew).toEqual([{ name: "Technicus", dayRate: 350, hourRate: 40, clientSpecific: true }]);
  });
});
