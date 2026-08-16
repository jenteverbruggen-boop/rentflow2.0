import type { PrismaClient } from "@/generated/prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { buildIcsCalendar, type IcsEvent } from "@/lib/ics";

function eventFromPeriod(period: {
  id: number;
  name: string;
  startDate: Date;
  endDate: Date;
  updatedAt: Date;
  project: { name: string; location: string | null; locationRel: { name: string } | null };
}, assignment?: { startAt: Date | null; endAt: Date | null; function?: { name: string } | null }): IcsEvent {
  // H1 — use the assignment's own hours when set, else the period window.
  const start = assignment?.startAt ?? period.startDate;
  const end = assignment?.endAt ?? period.endDate;
  const location = period.project.locationRel?.name ?? period.project.location;
  const descriptionParts = [`Project: ${period.project.name}`, `Periode: ${period.name}`];
  if (assignment?.function?.name) descriptionParts.push(`Functie: ${assignment.function.name}`);
  return {
    uid: `period-${period.id}@rentflow.app`,
    // Derived from Period.updatedAt (O1.1) — neither Period nor Project
    // carries a small sequential revision counter, so the timestamp
    // (seconds since epoch) stands in; it only needs to increase on
    // every edit, which it does by construction.
    sequence: Math.floor(period.updatedAt.getTime() / 1000),
    summary: `${period.project.name} - ${period.name}`,
    location,
    description: descriptionParts.join("\n"),
    start,
    end,
  };
}

/** A single explanatory event rather than a blank file — an empty .ics
 * with zero VEVENTs looks broken to a calendar client, and a user with
 * no linked person has nothing else to show them. */
function noPersonEvent(now: Date): IcsEvent {
  return {
    uid: `no-person-link@rentflow.app`,
    sequence: Math.floor(now.getTime() / 1000),
    summary: "RentFlow: geen personeelsprofiel gekoppeld",
    description:
      "Je gebruikersaccount is niet gekoppeld aan een personeelsprofiel, dus er zijn geen boekingen om te tonen. Vraag een beheerder om de koppeling te maken.",
    start: now,
    end: now,
  };
}

/** O1.2 — every period the user's linked person is booked on. */
export async function buildPersonalFeedIcs(
  userId: number,
  now: Date,
  client: PrismaClient = defaultPrisma,
): Promise<string> {
  const user = await client.user.findUnique({ where: { id: userId }, select: { personId: true } });
  if (!user?.personId) return buildIcsCalendar([noPersonEvent(now)], now);

  const assignments = await client.periodPerson.findMany({
    where: { personId: user.personId },
    include: {
      function: { select: { name: true } },
      period: {
        select: {
          id: true,
          name: true,
          startDate: true,
          endDate: true,
          updatedAt: true,
          project: { select: { name: true, location: true, locationRel: { select: { name: true } } } },
        },
      },
    },
    orderBy: { period: { startDate: "asc" } },
  });

  const events = assignments.map((a) => eventFromPeriod(a.period, a));
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
