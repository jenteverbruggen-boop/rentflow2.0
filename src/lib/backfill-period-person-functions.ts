import type { PrismaClient } from "@/generated/prisma/client";

export interface BackfillResult {
  matched: number;
  unmatched: { id: number; role: string }[];
}

/**
 * L2.1 — match every PeriodPerson row with no functionId yet (and a
 * non-null legacy `role` string) against Function.name by exact match,
 * and write functionId where one is found. Extracted as a pure-ish
 * function (takes a Prisma client, returns a result) so the
 * unmatched-row path — the one most likely to go untested against dev
 * seed data, since the seed's six people are a clean 1:1 match — can be
 * exercised directly against a deliberately mismatched fixture, not
 * only inferred from reading the script.
 */
export async function backfillPeriodPersonFunctions(
  prisma: PrismaClient,
): Promise<BackfillResult> {
  const functions = await prisma.function.findMany({ select: { id: true, name: true } });
  const byName = new Map(functions.map((f) => [f.name, f.id]));

  const candidates = await prisma.periodPerson.findMany({
    where: { functionId: null, role: { not: null } },
    select: { id: true, role: true },
  });

  let matched = 0;
  const unmatched: { id: number; role: string }[] = [];

  for (const row of candidates) {
    const functionId = byName.get(row.role!);
    if (functionId != null) {
      await prisma.periodPerson.update({ where: { id: row.id }, data: { functionId } });
      matched += 1;
    } else {
      unmatched.push({ id: row.id, role: row.role! });
    }
  }

  return { matched, unmatched };
}
