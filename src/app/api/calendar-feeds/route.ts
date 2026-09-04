import { NextRequest, NextResponse } from "next/server";
import { requireModule, forbidden, badRequest, serverError } from "@/lib/api-auth";
import { satisfies } from "@/lib/modules";
import { prisma } from "@/lib/prisma";
import { issueFeedToken } from "@/lib/calendar-feed";

/**
 * O1.4 — self-service feed-link management. Gated on `planning: lezen`
 * (the base module a feed's content belongs to) rather than a new
 * self-only exemption — anyone with no planning read access has no feed
 * to subscribe to either way. The stricter rules for `kind: "company"`
 * and for a person feed the caller doesn't own live one layer down, in
 * `issueFeedToken` (O1.3), not duplicated here.
 *
 * `?all=1` switches from "my two rows" to every person feed, for the
 * People page's per-person links. That listing exposes other people's
 * tokens, so it carries its own `personen: lezen` gate on top.
 */
export async function GET(req: NextRequest) {
  const access = await requireModule("planning", "lezen").catch(() => null);
  if (!access) return forbidden();
  try {
    if (req.nextUrl.searchParams.get("all") === "1") {
      if (!satisfies(access.permissions.personen ?? "geen", "lezen")) return forbidden();
      const feeds = await prisma.calendarFeed.findMany({
        where: { kind: "person" },
        orderBy: { personId: "asc" },
      });
      return NextResponse.json(feeds);
    }
    const feeds = await prisma.calendarFeed.findMany({
      where: {
        OR: [
          { userId: access.id },
          ...(access.personId !== null ? [{ personId: access.personId }] : []),
        ],
      },
      orderBy: { kind: "asc" },
    });
    return NextResponse.json(feeds);
  } catch (err) {
    return serverError((err as Error).message);
  }
}

export async function POST(req: NextRequest) {
  const access = await requireModule("planning", "lezen").catch(() => null);
  if (!access) return forbidden();
  try {
    const body = await req.json();
    if (body.kind !== "person" && body.kind !== "company") {
      return badRequest('kind moet "person" of "company" zijn');
    }
    // Omitted personId means "my own linked person" — that is what the
    // Settings page sends, and it never needs to know its own person id.
    const personId =
      body.personId === undefined || body.personId === null ? null : Number(body.personId);
    if (personId !== null && !Number.isInteger(personId)) {
      return badRequest("personId is ongeldig");
    }
    const result = await issueFeedToken(access, body.kind, personId);
    if ("error" in result) return badRequest(result.error);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return serverError((err as Error).message);
  }
}
