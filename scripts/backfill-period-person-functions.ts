/**
 * L2.1 — one-off backfill: match existing PeriodPerson rows' legacy
 * free-text `role` against `Function.name` and write `functionId` where
 * an exact match exists. `role` is left untouched (L4, phase 4, retires
 * it) — this only populates the new column so the callsheet (L2.3) and
 * booking picker (L2.2) can prefer it.
 *
 * Dev data (seed.ts) is a clean 1:1 name match by construction; real
 * production data may not be. Every unmatched row is logged with its
 * id and the `role` text that didn't match anything, rather than
 * guessing at a fuzzy match — the PO maps those by hand afterward.
 *
 * Run: npx tsx --env-file=.env.local scripts/backfill-period-person-functions.ts
 */
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { backfillPeriodPersonFunctions } from "../src/lib/backfill-period-person-functions";

const url = process.env.DATABASE_URL ?? "";
const adapter = url.startsWith("file:")
  ? new PrismaLibSql({ url })
  : new PrismaPg({ connectionString: url });
const prisma = new PrismaClient({ adapter });

async function main() {
  const { matched, unmatched } = await backfillPeriodPersonFunctions(prisma);
  console.log(`Backfill complete: ${matched} matched, ${unmatched.length} unmatched.`);
  if (unmatched.length > 0) {
    console.log("Unmatched rows (PeriodPerson.id, role) — map these by hand:");
    for (const row of unmatched) {
      console.log(`  #${row.id}: "${row.role}"`);
    }
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
