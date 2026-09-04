"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarFeedRow } from "@/components/calendar-feed-row";
import { useCalendarFeeds } from "@/hooks/use-calendar-feeds";
import { useAuthMe } from "@/hooks/use-auth-me";
import { satisfies } from "@/lib/modules";

/** O1.4 — feed-link management: the caller's own "mijn diensten" feed
 * for everyone with planning access, plus a company-wide feed for anyone
 * whose role is scope: all and has planning: lezen (mirrors
 * issueFeedToken's own O1.3 rule, so the "Aanmaken" button for a caller
 * who can't actually get one is never shown in the first place).
 *
 * The personal row stays here even though every person's feed is also
 * reachable from the People page: this is the only place a freelancer
 * with planning access but no `personen` access can find their own link.
 * Both surfaces issue the same person-scoped token. */
export function CalendarFeedLinks() {
  const { data: me } = useAuthMe();
  const { data: feeds } = useCalendarFeeds();
  const personal = feeds?.find((f) => f.kind === "person");
  const company = feeds?.find((f) => f.kind === "company");
  const canCompany = me?.scope !== "own" && satisfies(me?.permissions.planning ?? "geen", "lezen");
  const noLinkedPerson = me !== undefined && me.personId === null;

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
        <CalendarFeedRow
          kind="person"
          label="Mijn diensten"
          feed={personal}
          disabled={noLinkedPerson}
          warning={
            noLinkedPerson
              ? "Je account is niet gekoppeld aan een personeelsprofiel, dus er is geen persoonlijke feed. Vraag een beheerder om de koppeling te maken."
              : undefined
          }
        />
        {canCompany && (
          <CalendarFeedRow kind="company" label="Volledig bedrijf" feed={company} />
        )}
      </CardContent>
    </Card>
  );
}
