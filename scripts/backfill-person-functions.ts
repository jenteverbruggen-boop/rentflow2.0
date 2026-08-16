/**
 * L4.1 — one-off backfill: match every `Person.role` legacy free-text
 * value against `Function.name` and create the corresponding
 * `PersonFunction` row where an exact match exists and none already
 * does. `Person.role` itself is left untouched here — L4.2 (the next
 * commit) drops the column once this has been run and reviewed.
 *
 * Dev data (seed.ts) is a clean 1:1 name match by construction; real
 * production data may not be. Every unmatched row is logged with its id,
 * name and the `role` text that didn't match anything, rather than
 * guessing at a fuzzy match — the PO maps those by hand afterward.
 *
 * Run: npx tsx --env-file=.env.local scripts/backfill-person-functions.ts
 */
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { backfillPersonFunctions } from "../src/lib/backfill-person-functions";

const url = process.env.DATABASE_URL ?? "";
const adapter = url.startsWith("file:")
  ? new PrismaLibSql({ url })
  : new PrismaPg({ connectionString: url });
const prisma = new PrismaClient({ adapter });

async function main() {
  const { matched, alreadyLinked, unmatched } = await backfillPersonFunctions(prisma);
  console.log(
    `Backfill complete: ${matched} linked, ${alreadyLinked} already linked, ${unmatched.length} unmatched.`,
  );
  if (unmatched.length > 0) {
    console.log("Unmatched rows (Person.id, name, role) — map these by hand:");
    for (const row of unmatched) {
      console.log(`  #${row.id} (${row.name}): "${row.role}"`);
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
