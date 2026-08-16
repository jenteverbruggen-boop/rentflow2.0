"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useIssueCalendarFeed, useRevokeCalendarFeed } from "@/hooks/use-calendar-feeds";
import type { CalendarFeed, CalendarFeedKind } from "@/types";

interface Props {
  kind: CalendarFeedKind;
  label: string;
  feed?: CalendarFeed;
}

/** O1.4 — one row per feed kind: the URL (once issued) with copy, or an
 * "Aanmaken" action when none exists yet, plus revoke-and-reissue. */
export function CalendarFeedRow({ kind, label, feed }: Props) {
  const [copied, setCopied] = useState(false);
  const issue = useIssueCalendarFeed();
  const revoke = useRevokeCalendarFeed();
  // O1.2 — the route is `/api/calendar/[token]`, not `/api/calendar/[token].ics`
  // (a folder literally named `[token].ics` isn't a Next.js dynamic segment);
  // the `.ics` identity is served via the Content-Type/Content-Disposition
  // headers instead, so the URL itself carries no extension.
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const url = feed ? `${origin}/api/calendar/${feed.token}` : null;

  async function copy() {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-1">
        <p className="text-sm font-medium">{label}</p>
        {url ? (
          <p className="truncate text-xs text-muted-foreground" title={url}>
            {url}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">Nog geen link aangemaakt</p>
        )}
      </div>
      <div className="flex shrink-0 gap-2">
        {url && (
          <Button size="sm" variant="outline" onClick={copy}>
            {copied ? "Gekopieerd" : "Kopieer link"}
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          disabled={issue.isPending}
          onClick={() => issue.mutate(kind)}
        >
          {feed ? "Opnieuw genereren" : "Aanmaken"}
        </Button>
        {feed && (
          <Button
            size="sm"
            variant="ghost"
            disabled={revoke.isPending}
            onClick={() => revoke.mutate(feed.id)}
          >
            Intrekken
          </Button>
        )}
      </div>
      {issue.isError && (
        <p className="text-xs text-destructive sm:basis-full">{(issue.error as Error).message}</p>
      )}
    </div>
  );
}
