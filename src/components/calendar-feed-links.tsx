"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarFeedRow } from "@/components/calendar-feed-row";
import { useCalendarFeeds } from "@/hooks/use-calendar-feeds";
import { useAuthMe } from "@/hooks/use-auth-me";
import { satisfies } from "@/lib/modules";

/** O1.4 — feed-link management: a personal "mijn diensten" feed for
 * everyone with planning access, plus a company-wide feed for anyone
 * whose role is scope: all and has planning: lezen (mirrors
 * issueFeedToken's own O1.3 rule, so the "Aanmaken" button for a caller
 * who can't actually get one is never shown in the first place). */
export function CalendarFeedLinks() {
  const { data: me } = useAuthMe();
  const { data: feeds } = useCalendarFeeds();
  const personal = feeds?.find((f) => f.kind === "personal");
  const company = feeds?.find((f) => f.kind === "company");
  const canCompany = me?.scope !== "own" && satisfies(me?.permissions.planning ?? "geen", "lezen");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Agenda-feeds</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Abonneer met deze links in Google Agenda, Apple Agenda of Outlook.
          Google ververst een geabonneerde feed op zijn eigen schema, vaak
          maar om de paar uur (Apple/Outlook pollen vaker) — een wijziging
          hier is dus niet meteen zichtbaar in Google.
        </p>
        <CalendarFeedRow kind="personal" label="Mijn diensten" feed={personal} />
        {canCompany && (
          <CalendarFeedRow kind="company" label="Volledig bedrijf" feed={company} />
        )}
      </CardContent>
    </Card>
  );
}
