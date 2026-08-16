import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

vi.stubEnv("DATABASE_URL", `file:/tmp/compute-stats-init.db`);
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { execSync } from "child_process";
import os from "os";
import path from "path";
import fs from "fs";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "@/generated/prisma/client";
import { computeStats } from "@/lib/compute-stats";

const DB_PATH = path.join(os.tmpdir(), `compute-stats-${process.pid}.db`);
const DB_URL = `file:${DB_PATH}`;

let client: PrismaClient;
const ids = { clientA: 0, clientB: 0, projectA: 0, projectB: 0, personId: 0, materialId: 0 };

beforeAll(async () => {
  execSync(`DATABASE_URL=${DB_URL} npx prisma db push --schema=prisma/schema.dev.prisma`, { stdio: "pipe" });
  const adapter = new PrismaLibSql({ url: DB_URL });
  client = new PrismaClient({ adapter } as never);

  const clientA = await client.client.create({ data: { name: "Client A" } });
  const clientB = await client.client.create({ data: { name: "Client B" } });
  ids.clientA = clientA.id;
  ids.clientB = clientB.id;

  const person = await client.person.create({ data: { name: "Jan Peeters", dayPrice: 200 } });
  ids.personId = person.id;
  const material = await client.material.create({ data: { name: "Tent", dayPrice: 50 } });
  ids.materialId = material.id;
  const stockItem = await client.stockItem.create({ data: { materialId: material.id, unitNumber: 1 } });

  // Project A: one period entirely inside June, one booked person + one flat material.
  const projectA = await client.project.create({
    data: {
      name: "Project A", clientId: clientA.id,
      startDate: new Date("2026-06-01"), endDate: new Date("2026-06-02"),
      periods: {
        create: [{
          name: "Event", startDate: new Date("2026-06-01"), endDate: new Date("2026-06-02"),
          people: { create: [{ personId: person.id, dayPriceSnapshot: 200 }] },
          materials: { create: [{ stockItemId: stockItem.id, dayPriceSnapshot: 50, setupCostSnapshot: 0 }] },
        }],
      },
    },
  });
  ids.projectA = projectA.id;

  // Project B (client B): a period spanning the May/June boundary, to
  // exercise the pro-rata split end to end.
  const projectB = await client.project.create({
    data: {
      name: "Project B", clientId: clientB.id,
      startDate: new Date("2026-05-28"), endDate: new Date("2026-06-03"),
      periods: {
        create: [{ name: "Opbouw", startDate: new Date("2026-05-28"), endDate: new Date("2026-06-03") }],
      },
    },
  });
  ids.projectB = projectB.id;

  // An invoice for client A, invoiced in July for the June booking —
  // proving the booked/invoiced series deliberately disagree.
  const invoice = await client.invoice.create({
    data: {
      clientId: clientA.id, clientName: "Client A", projectId: projectA.id,
      status: "verzonden", number: "2026-0001", invoiceDate: new Date("2026-07-05"),
      subtotalExcl: 900, vatAmount: 189, totalIncl: 1089,
      lines: {
        create: [
          { kind: "person", description: "Jan", quantity: 2, unit: "dag", unitPrice: 200, vatRate: 21, lineTotalExcl: 400, sortOrder: 0 },
          { kind: "material", description: "Tent", quantity: 1, unit: "stuk", unitPrice: 500, vatRate: 21, lineTotalExcl: 500, sortOrder: 1 },
        ],
      },
    },
  });
  void invoice;
}, 60_000);

afterAll(async () => {
  await client.$disconnect();
  fs.rmSync(DB_PATH, { force: true });
});

describe("computeStats (K1.2 — real seeded data)", () => {
  it("attributes booked revenue to June for project A's fully-in-June period", async () => {
    const stats = await computeStats({ from: new Date("2026-06-01"), to: new Date("2026-06-30") }, client);
    const june = stats.revenueByMonth.find((m) => m.month === "2026-06")!;
    expect(june.bookedPeople).toBe(400); // 2 days x 200
    expect(june.bookedMaterials).toBe(100); // 2 days x 50
  });

  it("splits project B's period pro-rata across May and June", async () => {
    const stats = await computeStats({ from: new Date("2026-05-01"), to: new Date("2026-06-30") }, client);
    const months = new Map(stats.revenueByMonth.map((m) => [m.month, m]));
    expect(months.get("2026-05")).toBeDefined();
    expect(months.get("2026-06")).toBeDefined();
  });

  it("attributes invoiced revenue to July, not June — the two series deliberately disagree", async () => {
    const stats = await computeStats({ from: new Date("2026-06-01"), to: new Date("2026-07-31") }, client);
    const june = stats.revenueByMonth.find((m) => m.month === "2026-06")!;
    const july = stats.revenueByMonth.find((m) => m.month === "2026-07")!;
    expect(june.invoiced).toBe(0);
    expect(july.invoiced).toBe(900); // sum of the invoice's own two lines
  });

  it("revenueByClient totals both series per client", async () => {
    const stats = await computeStats({ from: new Date("2026-05-01"), to: new Date("2026-07-31") }, client);
    const clientA = stats.revenueByClient.find((c) => c.clientId === ids.clientA)!;
    expect(clientA.name).toBe("Client A");
    expect(clientA.booked).toBe(500); // 400 people + 100 material
    expect(clientA.invoiced).toBe(900);
    const clientB = stats.revenueByClient.find((c) => c.clientId === ids.clientB);
    expect(clientB?.booked).toBe(0); // no people/materials booked on project B
  });

  it("personUtilisation reports Jan's booked days", async () => {
    const stats = await computeStats({ from: new Date("2026-06-01"), to: new Date("2026-06-30") }, client);
    const jan = stats.personUtilisation.find((p) => p.personId === ids.personId);
    expect(jan?.bookedDays).toBe(2);
  });

  it("topMaterials lists Tent with its booked revenue", async () => {
    const stats = await computeStats({ from: new Date("2026-06-01"), to: new Date("2026-06-30") }, client);
    const tent = stats.topMaterials.find((m) => m.materialId === ids.materialId);
    expect(tent?.revenue).toBe(100);
  });

  it("an invoice's own invoiced figure equals the sum of its own lines (K1.2's explicit requirement)", async () => {
    const invoice = await client.invoice.findFirst({ where: { number: "2026-0001" }, include: { lines: true } });
    const lineSum = invoice!.lines.reduce((s, l) => s + Number(l.lineTotalExcl), 0);
    expect(Number(invoice!.subtotalExcl)).toBe(lineSum);
  });
});
