import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

// finalizeInvoice always receives an explicit `client` below, never its
// default-parameter fallback — mocked here purely so importing
// finalize-invoice.ts (which imports @/lib/prisma) doesn't trip
// env.ts's DATABASE_URL/JWT_SECRET validation when this file is
// collected by a default (non-Postgres) `npm test` run and skips
// itself before any test body executes.
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { finalizeInvoice } from "@/lib/finalize-invoice";

/**
 * J2b.3 (invoice-design.md §2.4) — SQLite serialises every write behind
 * one file lock, so a concurrency test run against it would pass
 * whether the counter is a correct atomic upsert or a buggy
 * read-lastSeq-then-write-it-back one: a false green either way. This
 * file only runs against real Postgres, guarded to skip everywhere
 * else so `npm test` (SQLite, per ci.yml) never silently executes zero
 * assertions and calls it green. Run explicitly via `npm run
 * test:postgres` against `docker compose up -d db`.
 */
const isPostgres = (process.env.DATABASE_URL ?? "").startsWith("postgresql://");

describe.skipIf(!isPostgres)("invoice numbering — Postgres concurrency (J2b.3)", () => {
  let client: PrismaClient;
  let clientId: number;

  beforeAll(async () => {
    const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL as string });
    client = new PrismaClient({ adapter } as never);
    const c = await client.client.create({ data: { name: "Numbering Concurrency Test Client" } });
    clientId = c.id;
  }, 60_000);

  afterAll(async () => {
    await client.invoice.deleteMany({ where: { clientId } });
    await client.client.delete({ where: { id: clientId } });
    await client.$disconnect();
  });

  function seqOf(number: string | null): number {
    return Number(number?.match(/(\d+)$/)?.[1]);
  }

  it("20 concurrent finalisations produce a gapless, duplicate-free sequence", async () => {
    const drafts = await Promise.all(
      Array.from({ length: 20 }, () =>
        client.invoice.create({ data: { clientId, clientName: "x", status: "concept" } }),
      ),
    );

    // One shared PrismaClient, all 20 finalisations fired at once — the
    // point is to race real Postgres connections, not in-process await
    // ordering (§2.4's own instruction: not one client per call).
    const results = await Promise.all(drafts.map((d) => finalizeInvoice(d.id, client)));
    expect(results).toHaveLength(20);

    const seqs = results.map((r) => seqOf(r.number)).sort((a, b) => a - b);
    expect(new Set(seqs).size).toBe(20); // no duplicates
    for (let i = 1; i < seqs.length; i++) {
      expect(seqs[i]).toBe(seqs[i - 1] + 1); // no gaps
    }
  }, 30_000);

  it("interleaved invoice + credit-note finalisations keep both series independent", async () => {
    const invoiceDrafts = await Promise.all(
      Array.from({ length: 10 }, () =>
        client.invoice.create({ data: { clientId, clientName: "x", status: "concept" } }),
      ),
    );
    const creditDrafts = await Promise.all(
      Array.from({ length: 10 }, () =>
        client.invoice.create({
          data: { clientId, clientName: "x", status: "concept", kind: "creditnota" },
        }),
      ),
    );

    // Interleaved in one Promise.all batch — an invoice finalising
    // between two credit notes must not consume a credit-series slot.
    const all = [...invoiceDrafts, ...creditDrafts].map((d) => finalizeInvoice(d.id, client));
    const results = await Promise.all(all);

    const invoiceSeqs = results
      .filter((r) => r.series === "invoice")
      .map((r) => seqOf(r.number))
      .sort((a, b) => a - b);
    const creditSeqs = results
      .filter((r) => r.series === "credit")
      .map((r) => seqOf(r.number))
      .sort((a, b) => a - b);

    expect(invoiceSeqs).toHaveLength(10);
    expect(creditSeqs).toHaveLength(10);
    expect(new Set(invoiceSeqs).size).toBe(10);
    expect(new Set(creditSeqs).size).toBe(10);
    for (let i = 1; i < invoiceSeqs.length; i++) expect(invoiceSeqs[i]).toBe(invoiceSeqs[i - 1] + 1);
    for (let i = 1; i < creditSeqs.length; i++) expect(creditSeqs[i]).toBe(creditSeqs[i - 1] + 1);
    expect(results.every((r) => r.number?.startsWith("CN-") === (r.series === "credit"))).toBe(true);
  }, 30_000);
});
