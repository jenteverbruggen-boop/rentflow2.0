import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PersonLinkSuggestion } from "@/types";

/** Drives both the nav badges and the banner on the People and Users
 * pages, so it is one shared query rather than a fetch per consumer. */
export function usePersonLinkSuggestions(enabled = true) {
  return useQuery<PersonLinkSuggestion[]>({
    queryKey: ["person-link-suggestions"],
    queryFn: () => fetch("/api/person-link-suggestions").then((r) => (r.ok ? r.json() : [])),
    enabled,
  });
}

/** Applying a suggestion is the plain user edit it would be by hand —
 * no dedicated endpoint, so the suggestion list can never be a write
 * path of its own. */
export function useApplyPersonLink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, personId }: { userId: number; personId: number }) =>
      fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personId }),
      }).then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error ?? "Koppelen mislukt");
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["person-link-suggestions"] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["people"] });
      queryClient.invalidateQueries({ queryKey: ["auth-me"] });
    },
  });
}
