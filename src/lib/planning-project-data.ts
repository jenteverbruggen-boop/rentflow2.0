import { startOfDay, endOfDay } from "date-fns";
import type { PlanningProject, PlanningPeriod } from "@/lib/planning-include";
import type { DayBlockPeriod } from "@/lib/planning-day-blocks";

export interface PeriodWithProject {
  period: PlanningPeriod;
  project: PlanningProject;
}

/** I2.2 — every (period, parent project) pair touching `day` — the
 * week/month views now bucket by *period*, not the whole project
 * (a Mon–Fri project with a single Wednesday period no longer paints
 * Mon/Tue/Thu/Fri). */
export function periodsOnDay(projects: PlanningProject[], day: Date): PeriodWithProject[] {
  const dayStart = startOfDay(day);
  const dayEnd = endOfDay(day);
  const result: PeriodWithProject[] = [];
  for (const project of projects) {
    for (const period of project.periods) {
      if (new Date(period.startDate) <= dayEnd && new Date(period.endDate) >= dayStart) {
        result.push({ period, project });
      }
    }
  }
  return result;
}

export function allPeriods(projects: PlanningProject[]): PeriodWithProject[] {
  return projects.flatMap((project) => project.periods.map((period) => ({ period, project })));
}

/** Per-project totals across every period touching the visible range —
 * the "Alle projecten deze week" list still groups by project, summed
 * from the lean per-period counts rather than full nested arrays. */
export function projectTotals(pairs: PeriodWithProject[]) {
  const byProject = new Map<number, { project: PlanningProject; people: number; materials: number }>();
  for (const { period, project } of pairs) {
    const entry = byProject.get(project.id) ?? { project, people: 0, materials: 0 };
    entry.people += period.peopleCount;
    entry.materials += period.materialsCount;
    byProject.set(project.id, entry);
  }
  return [...byProject.values()];
}

/** I1.3 — flattens every project's periods into the shape
 * PlanningDayTimeline needs, carrying the parent project's name/status
 * along since a period itself has neither. */
export function projectsToDayPeriods(projects: PlanningProject[]): DayBlockPeriod[] {
  return allPeriods(projects).map(({ period, project }) => ({
    id: period.id,
    projectId: project.id,
    projectName: project.name,
    status: project.status,
    startDate: period.startDate,
    endDate: period.endDate,
  }));
}
