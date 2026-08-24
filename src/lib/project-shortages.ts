import type { Project } from "@/types";

export interface ProjectShortageLine {
  id: number;
  periodId: number;
  periodName: string;
  materialName: string;
  quantity: number;
  /** A set's component shortfall reads differently from a flat material's:
   * the set itself is booked, only its parts are missing. */
  isBundleComponent: boolean;
}

/**
 * Overboeken — flattens every open shortage row on the project payload for
 * display (the Materialen-tab banner, the header badge). Derived from the
 * `/api/projects/[id]` data rather than fetched separately, so it survives
 * a reload and stays in step with the rest of the project cache.
 */
export function projectShortageLines(project: Project): ProjectShortageLine[] {
  return project.periods.flatMap((period) =>
    (period.shortages ?? []).map((s) => ({
      id: s.id,
      periodId: period.id,
      periodName: period.name,
      materialName: s.material.name,
      quantity: s.quantity,
      isBundleComponent: s.bundleBookingId != null,
    })),
  );
}
