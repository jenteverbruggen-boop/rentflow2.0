import type { PrismaClient } from "@/generated/prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import type { DateRange } from "@/lib/fetch-projects";
import type { ScopeAccess } from "@/lib/scope-filter";

export interface PersonBooking {
  periodPersonId: number;
  periodId: number;
  projectId: number;
  projectName: string;
  status: string;
  periodStart: string;
  periodEnd: string;
  startAt: string | null;
  endAt: string | null;
  billingUnit: string;
  overlapAck: boolean;
}

export interface PersonRow {
  personId: number;
  name: string;
  bookings: PersonBooking[];
}

/**
 * I3.1 — one row per person, their bookings across the range. A
 * dedicated query rather than deriving from I2.1's project-shaped
 * payload: that endpoint's lean planning shape carries only a
 * `peopleCount` per period, never who — there is no person identity
 * in it to derive a person-centric view from client-side.
 *
 * `scope: own` is enforced here by filtering to the caller's own
 * `personId` (never a 403) — the person view's "one row" for a
 * scoped user falls out of this filter by construction, not a
 * separate client-side check that could drift from it.
 */
export async function fetchPlanningPersonRows(
  access: ScopeAccess,
  range: DateRange,
  client: PrismaClient = defaultPrisma,
): Promise<PersonRow[]> {
  const assignments = await client.periodPerson.findMany({
    where: {
      period: { AND: [{ startDate: { lt: range.to } }, { endDate: { gt: range.from } }] },
      ...(access.scope === "own" ? { personId: access.personId ?? -1 } : {}),
    },
    include: {
      person: { select: { id: true, name: true } },
      period: {
        select: {
          id: true,
          startDate: true,
          endDate: true,
          project: { select: { id: true, name: true, status: true } },
        },
      },
    },
    orderBy: { period: { startDate: "asc" } },
  });

  const byPerson = new Map<number, PersonRow>();
  for (const a of assignments) {
    const row = byPerson.get(a.personId) ?? { personId: a.personId, name: a.person.name, bookings: [] };
    row.bookings.push({
      periodPersonId: a.id,
      periodId: a.period.id,
      projectId: a.period.project.id,
      projectName: a.period.project.name,
      status: a.period.project.status,
      periodStart: a.period.startDate.toISOString(),
      periodEnd: a.period.endDate.toISOString(),
      startAt: a.startAt ? a.startAt.toISOString() : null,
      endAt: a.endAt ? a.endAt.toISOString() : null,
      billingUnit: a.billingUnit,
      overlapAck: a.overlapAck,
    });
    byPerson.set(a.personId, row);
  }

  return [...byPerson.values()].sort((a, b) => a.name.localeCompare(b.name));
}
