import { randomBytes } from "node:crypto";
import type { PrismaClient } from "@/generated/prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import type { ResolvedAccess } from "@/lib/api-auth";
import { satisfies } from "@/lib/modules";
import type { AccessLevel, CalendarFeedKind } from "@/types";

/** O1.1 — `node:crypto`-random, never `Math.random`, never the JWT. */
function generateFeedToken(): string {
  return randomBytes(24).toString("hex");
}

/** O1.2/O1.3 — resolve a feed token to the user + kind it belongs to.
 * Returns `null` for a bogus/revoked token — the route maps that to a
 * plain 404, never an HTML redirect. */
export async function resolveFeedToken(
  token: string,
  client: PrismaClient = defaultPrisma,
) {
  return client.calendarFeed.findUnique({ where: { token } });
}

/** O1.4 — issue or reissue (revoke-then-create, via `upsert`) a feed.
 * `kind: "company"` requires `planning: lezen` and is refused outright
 * for `scope: own` (O1.3's own-scoped-role rule). `kind: "person"`
 * targets a person rather than the caller: issuing one for your own
 * linked person is self-service, issuing one for anybody else is an
 * administrative act and needs `personen: wijzigen`. */
export async function issueFeedToken(
  access: ResolvedAccess,
  kind: CalendarFeedKind,
  personId: number | null,
  client: PrismaClient = defaultPrisma,
): Promise<{ token: string } | { error: string }> {
  const token = generateFeedToken();

  if (kind === "company") {
    if (access.scope === "own") return { error: "Bedrijfsfeed is niet beschikbaar voor dit account" };
    if (!satisfies(access.permissions.planning ?? "geen", "lezen")) {
      return { error: "Onvoldoende rechten voor de bedrijfsfeed" };
    }
    await client.calendarFeed.upsert({
      where: { userId_kind: { userId: access.id, kind } },
      create: { userId: access.id, kind, token },
      update: { token },
    });
    return { token };
  }

  const target = personId ?? access.personId;
  if (target === null) {
    return { error: "Je account is niet gekoppeld aan een personeelsprofiel" };
  }
  if (!canManagePersonFeed(access, target)) {
    return { error: "Onvoldoende rechten voor de agenda-feed van deze persoon" };
  }
  const person = await client.person.findUnique({ where: { id: target } });
  if (!person) return { error: "Persoon niet gevonden" };

  await client.calendarFeed.upsert({
    where: { personId: target },
    create: { personId: target, kind: "person", token },
    update: { token },
  });
  return { token };
}

/** Your own person feed is yours to manage on `planning: lezen` alone —
 * the Settings page offers it to every planning-capable role, including
 * a freelancer with no `personen` access at all. Anyone else's is an
 * administrative act on someone else's data, hence `personen: wijzigen`
 * rather than the read level the People page itself is gated on. */
export function canManagePersonFeed(access: ResolvedAccess, personId: number): boolean {
  if (access.personId === personId) {
    return satisfies(access.permissions.planning ?? "geen", "lezen");
  }
  return satisfies(access.permissions.personen ?? "geen", "wijzigen");
}

/** Mirrors `issueFeedToken`'s own authorisation exactly — revoking a
 * feed is as consequential as reissuing one, and a caller who may not
 * hand out a person's URL may not silently break their subscription
 * either. A feed the caller may not touch is reported as absent rather
 * than forbidden, so this cannot enumerate other people's feed ids. */
export async function revokeFeedToken(
  access: ResolvedAccess,
  id: number,
  client: PrismaClient = defaultPrisma,
): Promise<boolean> {
  const feed = await client.calendarFeed.findUnique({ where: { id } });
  if (!feed) return false;
  const allowed =
    feed.personId !== null
      ? canManagePersonFeed(access, feed.personId)
      : feed.userId === access.id;
  if (!allowed) return false;
  await client.calendarFeed.delete({ where: { id } });
  return true;
}

/**
 * Found by review: the design doc's own requirement is that the
 * feed-*serving* route re-checks the token owner's current scope on
 * every request, not only at issue/revoke time — revoke-on-change
 * (below) covers a role reassignment or a scope edit, but a `planning`
 * module *downgrade* via the permission matrix touches neither `roleId`
 * nor `scope`, so it would otherwise slip through undetected until the
 * next unrelated role/scope edit. This closes that gap directly: called
 * from the serving route on every request for a `company`-kind feed
 * (cheap — one row lookup, same shape as `requireModule`'s own
 * per-request re-resolution, no caching).
 */
export async function isCompanyFeedStillEligible(
  userId: number,
  client: PrismaClient = defaultPrisma,
): Promise<boolean> {
  const user = await client.user.findUnique({
    where: { id: userId },
    select: { roleRel: { select: { scope: true, permissions: { where: { module: "planning" } } } } },
  });
  if (!user?.roleRel) return false;
  if (user.roleRel.scope === "own") return false;
  const level = (user.roleRel.permissions[0]?.access ?? "geen") as AccessLevel;
  return satisfies(level, "lezen");
}

/** O1.3 — called from the two write paths that can invalidate a company
 * feed: reassigning a user's role (`PATCH /api/users/[id]`) and editing
 * a role's scope (`PUT /api/roles/[id]`). Only `company` is revoked this
 * way; a person feed's eligibility never depends on role or scope. */
export async function revokeCompanyFeedForUser(
  userId: number,
  client: PrismaClient = defaultPrisma,
): Promise<void> {
  await client.calendarFeed.deleteMany({ where: { userId, kind: "company" } });
}

export async function revokeCompanyFeedsForRole(
  roleId: number,
  client: PrismaClient = defaultPrisma,
): Promise<void> {
  const users = await client.user.findMany({ where: { roleId }, select: { id: true } });
  if (users.length === 0) return;
  await client.calendarFeed.deleteMany({
    where: { userId: { in: users.map((u) => u.id) }, kind: "company" },
  });
}
