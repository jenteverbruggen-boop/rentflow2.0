"use client";

import { Badge } from "@/components/ui/badge";
import { usePersonLinkSuggestions } from "@/hooks/use-person-link-suggestions";
import { useAuthMe } from "@/hooks/use-auth-me";
import { satisfies } from "@/lib/modules";

/** Counts the unambiguous e-mail matches waiting for an admin, shown on
 * the Personen and Gebruikers nav items.
 *
 * Deliberately not a count of unlinked users: a person link is optional
 * by design, so badging every account without one would be a permanent
 * unclearable number. Only an actionable suggestion shows up. */
export function NavSuggestionBadge() {
  const { data: me } = useAuthMe();
  const { data: suggestions } = usePersonLinkSuggestions(
    satisfies(me?.permissions.gebruikers ?? "geen", "lezen"),
  );
  const count = suggestions?.length ?? 0;
  if (count === 0) return null;

  return (
    <Badge
      className="ml-auto shrink-0"
      aria-label={`${count} openstaande koppelsuggestie${count === 1 ? "" : "s"}`}
    >
      {count}
    </Badge>
  );
}
