import type { PrismaClient } from "@/generated/prisma/client";

export interface PersonBackfillResult {
  matched: number;
  alreadyLinked: number;
  unmatched: { id: number; name: string; role: string }[];
}

/**
 * L4.1 — the `PeriodPerson.role`→`functionId` backfill (L2.1) already
 * covers individual bookings; this is its `Person.role` counterpart —
 * every person with a legacy role and no `PersonFunction` row for the
 * matching `Function.name` gets one created (no rate override, so the
 * function's own default rate applies), by exact name match only. A
 * person whose role already matches one of their existing
 * `PersonFunction` rows is left alone (`alreadyLinked`); anything with no
 * match is reported for the PO to map by hand, never guessed at.
 */
export async function backfillPersonFunctions(
  prisma: PrismaClient,
): Promise<PersonBackfillResult> {
  const functions = await prisma.function.findMany({ select: { id: true, name: true } });
  const byName = new Map(functions.map((f) => [f.name, f.id]));

  const candidates = await prisma.person.findMany({
    where: { role: { not: null } },
    select: { id: true, name: true, role: true, functions: { select: { functionId: true } } },
  });

  let matched = 0;
  let alreadyLinked = 0;
  const unmatched: { id: number; name: string; role: string }[] = [];

  for (const person of candidates) {
    const functionId = byName.get(person.role!);
    if (functionId == null) {
      unmatched.push({ id: person.id, name: person.name, role: person.role! });
      continue;
    }
    if (person.functions.some((f) => f.functionId === functionId)) {
      alreadyLinked += 1;
      continue;
    }
    await prisma.personFunction.create({ data: { personId: person.id, functionId } });
    matched += 1;
  }

  return { matched, alreadyLinked, unmatched };
}
