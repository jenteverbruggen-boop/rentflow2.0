import { NextRequest, NextResponse } from "next/server";
import { resolveFeedToken } from "@/lib/calendar-feed";
import { buildPersonalFeedIcs, buildCompanyFeedIcs } from "@/lib/calendar-feed-ics";

type Params = { params: Promise<{ token: string }> };

/**
 * O1.2/O1.3 — token-authenticated, not cookie-authenticated: exempted
 * from proxy.ts's auth redirect (the `/api/calendar/` prefix). A
 * bogus/revoked token is a plain 404 JSON body, never an HTML redirect —
 * a calendar client following this URL cannot follow a redirect to
 * /login the way a browser tab can.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const { token } = await params;
  const feed = await resolveFeedToken(token);
  if (!feed) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const now = new Date();
  const ics =
    feed.kind === "company"
      ? await buildCompanyFeedIcs(now)
      : await buildPersonalFeedIcs(feed.userId, now);

  return new NextResponse(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="rentflow.ics"',
    },
  });
}
