import type { Project, ProjectStatus } from "@/types";

/** Which projects the list shows. `open` is the default and hides the
 * finished/cancelled ones that otherwise bury the current work. */
export type ProjectStatusFilter = "open" | "afgerond" | "geannuleerd" | "all";

const OPEN: ProjectStatus[] = ["concept", "bevestigd", "actief"];

export function isOpenStatus(status: ProjectStatus): boolean {
  return OPEN.includes(status);
}

function matchesStatus(p: Project, filter: ProjectStatusFilter): boolean {
  if (filter === "all") return true;
  if (filter === "open") return isOpenStatus(p.status);
  return p.status === filter;
}

function haystack(p: Project): string {
  return [
    p.name, p.client, p.location, p.status, p.notes,
    p.clientRel?.name, p.clientRel?.contactName, p.clientRel?.city,
    p.locationRel?.name, p.locationRel?.address, p.locationRel?.city,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/** Every whitespace-separated word of `query` must appear somewhere in the
 * project's name, client, location, status or notes ("brugge summer"
 * finds a Summer Sounds project in Brugge). */
function matchesQuery(p: Project, query: string): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const text = haystack(p);
  return words.every((w) => text.includes(w));
}

export function filterProjects(
  projects: Project[],
  filter: ProjectStatusFilter,
  query: string,
): Project[] {
  return projects.filter((p) => matchesStatus(p, filter) && matchesQuery(p, query));
}

/** How many projects the status filter hides for this query — drives the
 * "n verborgen" hint so a search never silently misses a finished project. */
export function hiddenByStatus(
  projects: Project[],
  filter: ProjectStatusFilter,
  query: string,
): number {
  return filterProjects(projects, "all", query).length - filterProjects(projects, filter, query).length;
}
