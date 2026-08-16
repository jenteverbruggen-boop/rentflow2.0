import { startOfDay, endOfDay } from "date-fns";
import type { Project } from "@/types";
import type { DayBlockPeriod } from "@/lib/planning-day-blocks";

/** Whole projects touching `day` — the week/month views still place
 * whole projects, not periods (I2 replaces this with period-level
 * bucketing + a range-filtered endpoint). */
export function projectsOnDay(projects: Project[], day: Date): Project[] {
  const dayStart = startOfDay(day);
  const dayEnd = endOfDay(day);
  return projects.filter((p) => new Date(p.startDate) <= dayEnd && new Date(p.endDate) >= dayStart);
}

export function countAssignments(project: Project) {
  let people = 0;
  let materials = 0;
  for (const period of project.periods) {
    people += period.people.length;
    materials += period.materials.length;
  }
  return { people, materials };
}

/** I1.3 — flattens every project's periods into the shape
 * PlanningDayTimeline needs, carrying the parent project's name/status
 * along since a period itself has neither. */
export function projectsToDayPeriods(projects: Project[]): DayBlockPeriod[] {
  return projects.flatMap((p) =>
    p.periods.map((period) => ({
      id: period.id,
      projectId: p.id,
      projectName: p.name,
      status: p.status,
      startDate: period.startDate,
      endDate: period.endDate,
    })),
  );
}
