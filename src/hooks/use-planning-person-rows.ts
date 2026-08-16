import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import type { PersonRow } from "@/lib/planning-person-rows";

/** I3.1 — the person-mode counterpart to usePlanningProjects. `enabled`
 * lets the page skip this fetch entirely while in project mode. */
export function usePlanningPersonRows(from: Date, to: Date, enabled: boolean) {
  const fromStr = format(from, "yyyy-MM-dd");
  const toStr = format(to, "yyyy-MM-dd");
  return useQuery({
    queryKey: ["planning-persons", fromStr, toStr],
    queryFn: async (): Promise<PersonRow[]> => {
      const res = await fetch(`/api/planning/persons?from=${fromStr}&to=${toStr}`);
      if (!res.ok) throw new Error("Ophalen mislukt");
      return res.json();
    },
    staleTime: 60_000,
    enabled,
  });
}
