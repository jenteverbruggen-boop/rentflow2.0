"use client";

import { CalendarFeedRow } from "@/components/calendar-feed-row";
import { usePersonCalendarFeeds } from "@/hooks/use-calendar-feeds";
import { useAuthMe } from "@/hooks/use-auth-me";
import { satisfies } from "@/lib/modules";

interface Props {
  personId: number;
}

/** A feed per person, issued from the People page — the person needs no
 * user account, which is the whole point: most of the roster is booked
 * without ever logging in, and an admin hands them the URL.
 *
 * Rendered inside the expanded person card, so the `?all=1` listing is
 * only fetched once a card is actually opened. */
export function PersonCalendarFeed({ personId }: Props) {
  const { data: me } = useAuthMe();
  const canRead = satisfies(me?.permissions.planning ?? "geen", "lezen");
  const { data: feeds } = usePersonCalendarFeeds(canRead);

  if (!canRead) return null;
  const feed = feeds?.find((f) => f.personId === personId);
  const ownFeed = me?.personId === personId;

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Agenda-feed</p>
      <CalendarFeedRow
        kind="person"
        personId={personId}
        label={ownFeed ? "Diensten (jouw eigen feed)" : "Diensten van deze persoon"}
        feed={feed}
      />
    </div>
  );
}
