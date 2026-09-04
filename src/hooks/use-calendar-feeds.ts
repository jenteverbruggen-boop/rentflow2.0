import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CalendarFeed, CalendarFeedKind } from "@/types";

/** O1.4 — the caller's own rows: their company feed, plus the person
 * feed of whoever they are linked to. Resolved from the session, so
 * there is no id to pass. */
export function useCalendarFeeds() {
  return useQuery<CalendarFeed[]>({
    queryKey: ["calendar-feeds"],
    queryFn: () => fetch("/api/calendar-feeds").then((r) => r.json()),
  });
}

/** Every person's feed, for the People page. Separate key from the
 * caller's own rows: the two overlap on the caller's own person, and
 * issuing from either place must refresh both. */
export function usePersonCalendarFeeds(enabled = true) {
  return useQuery<CalendarFeed[]>({
    queryKey: ["calendar-feeds", "all"],
    queryFn: () => fetch("/api/calendar-feeds?all=1").then((r) => r.json()),
    enabled,
  });
}

export interface IssueFeedInput {
  kind: CalendarFeedKind;
  /** Omit for "my own linked person" — the server resolves it. */
  personId?: number;
}

export function useIssueCalendarFeed() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: IssueFeedInput) =>
      fetch("/api/calendar-feeds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }).then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error ?? "Aanmaken mislukt");
        return r.json();
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["calendar-feeds"] }),
  });
}

export function useRevokeCalendarFeed() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => fetch(`/api/calendar-feeds/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["calendar-feeds"] }),
  });
}
