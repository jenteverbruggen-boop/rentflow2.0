import type { PrismaClient } from "@/generated/prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { buildIcsCalendar } from "@/lib/ics";
import { eventFromPeriod } from "@/lib/calendar-feed-event";
import { loadPeriodMaterialLines } from "@/lib/calendar-feed-materials";

/** Materials are only worth listing for work that is current or coming up —
 * a person's feed holds every booking they ever had, and loading booked
 * units for years of history on every calendar poll buys nothing. */
const MATERIAL_HISTORY_DAYS = 7;

/** O1.2 — every period the person is booked on. Keyed on the person
 * itself, not on a user account: someone with no login still has
 * bookings, and an admin can hand them the URL from the People page. */
export async function buildPersonFeedIcs(
  personId: number,
  now: Date,
  client: PrismaClient = defaultPrisma,
): Promise<string> {
  const assignments = await client.periodPerson.findMany({
    where: { personId },
    include: {
      function: { select: { name: true } },
      days: { orderBy: { startAt: "asc" } },
      period: {
        select: {
          id: true,
          name: true,
          startDate: true,
          endDate: true,
          updatedAt: true,
          project: {
            select: {
              name: true,
              location: true,
              locationRel: { select: { name: true, address: true, postalCode: true, city: true } },
            },
          },
        },
      },
    },
    orderBy: { period: { startDate: "asc" } },
  });

  const cutoff = new Date(now.getTime() - MATERIAL_HISTORY_DAYS * 86_400_000);
  const materialLines = await loadPeriodMaterialLines(
    client,
    [...new Set(assignments.filter((a) => a.period.endDate >= cutoff).map((a) => a.period.id))],
  );
  const extras = (periodId: number) => ({ materialLines: materialLines.get(periodId), fullAddress: true });

  // H6 — a person booked for specific days gets one event *per day*, not
  // one block spanning the gaps: a Mon+Fri booking must not black out the
  // whole week in their calendar. Each day needs its own UID or a client
  // would collapse them into a single moved event.
  const events = assignments.flatMap((a) =>
    a.days.length > 0
      ? a.days.map((d) => ({
          ...eventFromPeriod(a.period, { ...a, startAt: d.startAt, endAt: d.endAt }, extras(a.period.id)),
          uid: `period-${a.period.id}-day-${d.id}@rentflow.app`,
        }))
      : [eventFromPeriod(a.period, a, extras(a.period.id))],
  );
  return buildIcsCalendar(events, now);
}

/** O1.3 — every project/period, unfiltered. Gated at issuance (never
 * given to a scope: own role), not at serving time — a token in a URL
 * can't be re-checked against a changing matrix on every poll, so
 * `revokeCompanyFeedForUser`/`revokeCompanyFeedsForRole` (calendar-feed.ts)
 * are the actual enforcement point when a role or its scope changes. */
export async function buildCompanyFeedIcs(
  now: Date,
  client: PrismaClient = defaultPrisma,
): Promise<string> {
  const periods = await client.period.findMany({
    select: {
      id: true,
      name: true,
      startDate: true,
      endDate: true,
      updatedAt: true,
      project: { select: { name: true, location: true, locationRel: { select: { name: true } } } },
    },
    orderBy: { startDate: "asc" },
  });
  const events = periods.map((p) => eventFromPeriod(p));
  return buildIcsCalendar(events, now);
}
