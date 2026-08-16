import type { Prisma } from "@/generated/prisma/client";

/**
 * I2.1 — a materially lighter include than `projectInclude` for the
 * range-filtered planning path: periods with a people/materials
 * **count** each, never the full nested person/material/travel-cost
 * trees the week/month calendar cells never render anyway. This is
 * what "a month of a year's data loads without fetching every booking
 * line" means in practice.
 */
export const planningProjectInclude = {
  periods: {
    orderBy: { startDate: "asc" },
    include: {
      _count: { select: { people: true, materials: true } },
    },
  },
} satisfies Prisma.ProjectInclude;

export type PlanningProjectRow = Prisma.ProjectGetPayload<{ include: typeof planningProjectInclude }>;

export interface PlanningPeriod {
  id: number;
  projectId: number;
  name: string;
  startDate: string;
  endDate: string;
  peopleCount: number;
  materialsCount: number;
}

export interface PlanningProject {
  id: number;
  name: string;
  client: string | null;
  location: string | null;
  status: string;
  periods: PlanningPeriod[];
}

export function serializePlanningProject(project: PlanningProjectRow): PlanningProject {
  return {
    id: project.id,
    name: project.name,
    client: project.client,
    location: project.location,
    status: project.status,
    periods: project.periods.map((period) => ({
      id: period.id,
      projectId: project.id,
      name: period.name,
      startDate: period.startDate.toISOString(),
      endDate: period.endDate.toISOString(),
      peopleCount: period._count.people,
      materialsCount: period._count.materials,
    })),
  };
}
