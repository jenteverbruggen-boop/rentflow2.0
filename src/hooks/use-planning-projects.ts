import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import type { PlanningProject } from "@/lib/planning-include";

/** I2.2 — the range-filtered, lean planning shape (I2.1's own
 * endpoint), replacing planning/page.tsx's old unfiltered
 * `/api/projects` fetch. A month of a year's data loads without
 * fetching every booking line. */
export function usePlanningProjects(from: Date, to: Date) {
  const fromStr = format(from, "yyyy-MM-dd");
  const toStr = format(to, "yyyy-MM-dd");
  return useQuery({
    queryKey: ["planning-projects", fromStr, toStr],
    queryFn: async (): Promise<PlanningProject[]> => {
      const res = await fetch(`/api/projects?from=${fromStr}&to=${toStr}`);
      if (!res.ok) throw new Error("Ophalen mislukt");
      return res.json();
    },
    staleTime: 60_000,
  });
}
