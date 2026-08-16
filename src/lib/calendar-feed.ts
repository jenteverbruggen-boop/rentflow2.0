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

/** O1.4 — issue or reissue (revoke-then-create, via `upsert`) a token for
 * the calling user. `kind: "company"` requires `planning: lezen` and is
 * refused outright for `scope: own` (O1.3's own-scoped-role rule). */
export async function issueFeedToken(
  access: ResolvedAccess,
  kind: CalendarFeedKind,
  client: PrismaClient = defaultPrisma,
): Promise<{ token: string } | { error: string }> {
  if (kind === "company") {
    if (access.scope === "own") return { error: "Bedrijfsfeed is niet beschikbaar voor dit account" };
    if (!satisfies(access.permissions.planning ?? "geen", "lezen")) {
      return { error: "Onvoldoende rechten voor de bedrijfsfeed" };
    }
  }
  const token = generateFeedToken();
  await client.calendarFeed.upsert({
    where: { userId_kind: { userId: access.id, kind } },
    create: { userId: access.id, kind, token },
    update: { token },
  });
  return { token };
}

export async function revokeFeedToken(
  userId: number,
  id: number,
  client: PrismaClient = defaultPrisma,
): Promise<boolean> {
  const feed = await client.calendarFeed.findUnique({ where: { id } });
  if (!feed || feed.userId !== userId) return false;
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

/** O1.3 — "revoke the token when a user's role or scope changes" is
 * enforced here, called from the two write paths that can invalidate a
 * company feed's eligibility: reassigning a user's role
 * (`PATCH /api/users/[id]`) and editing a role's own scope
 * (`PUT /api/roles/[id]`). Only the `company` kind is ever revoked this
 * way — the personal feed's eligibility never depends on role/scope.
 * A pure `planning` matrix downgrade (neither `roleId` nor `scope`
 * touched) is now caught instead by `isCompanyFeedStillEligible`'s
 * per-request check above, so this eager revoke and that lazy check
 * together cover every eligibility-changing edit. */
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
