import { NextRequest, NextResponse } from "next/server";
import { requireModule, forbidden, badRequest, serverError } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { issueFeedToken } from "@/lib/calendar-feed";

/**
 * O1.4 — self-service feed-link management. Gated on `planning: lezen`
 * (the base module a feed's content belongs to) rather than a new
 * self-only exemption — anyone with no planning read access has no feed
 * to subscribe to either way. The stricter `scope: own` refusal for
 * `kind: "company"` is enforced one layer down, in `issueFeedToken`
 * (O1.3), not duplicated here.
 */
export async function GET() {
  const access = await requireModule("planning", "lezen").catch(() => null);
  if (!access) return forbidden();
  try {
    const feeds = await prisma.calendarFeed.findMany({
      where: { userId: access.id },
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
    if (body.kind !== "personal" && body.kind !== "company") {
      return badRequest('kind moet "personal" of "company" zijn');
    }
    const result = await issueFeedToken(access, body.kind);
    if ("error" in result) return badRequest(result.error);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return serverError((err as Error).message);
  }
}
