"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useIssueCalendarFeed, useRevokeCalendarFeed } from "@/hooks/use-calendar-feeds";
import type { CalendarFeed, CalendarFeedKind } from "@/types";

interface Props {
  kind: CalendarFeedKind;
  /** Omit for "my own linked person"; set when an admin manages someone
   * else's feed from the People page. */
  personId?: number;
  label: string;
  feed?: CalendarFeed;
  /** Standing caveat about what this feed will contain — shown under the
   * URL, so it reads as belonging to this feed rather than to the card. */
  warning?: string;
  /** No feed can exist for this row yet (e.g. the caller has no linked
   * person). The warning explains why; the actions just go inert. */
  disabled?: boolean;
}

/** O1.4 — one row per feed kind: the URL (once issued) with copy, or an
 * "Aanmaken" action when none exists yet, plus revoke-and-reissue. */
export function CalendarFeedRow({ kind, personId, label, feed, warning, disabled }: Props) {
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
    <div className="@container rounded-lg border p-3">
      <div className="flex flex-col gap-2 @md:flex-row @md:items-center @md:justify-between">
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
            disabled={disabled || issue.isPending}
            onClick={() => issue.mutate({ kind, personId })}
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
      </div>
      {warning && <p className="mt-2 text-xs text-amber-500">{warning}</p>}
      {issue.isError && (
        <p className="mt-2 text-xs text-destructive">{(issue.error as Error).message}</p>
      )}
    </div>
  );
}
