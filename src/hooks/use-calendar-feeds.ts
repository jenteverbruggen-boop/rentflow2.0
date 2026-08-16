import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CalendarFeed, CalendarFeedKind } from "@/types";

/** O1.4 — the caller's own feed rows (never anyone else's; the route
 * resolves them from the session, there is no id param to pass). */
export function useCalendarFeeds() {
  return useQuery<CalendarFeed[]>({
    queryKey: ["calendar-feeds"],
    queryFn: () => fetch("/api/calendar-feeds").then((r) => r.json()),
  });
}

export function useIssueCalendarFeed() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (kind: CalendarFeedKind) =>
      fetch("/api/calendar-feeds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind }),
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
