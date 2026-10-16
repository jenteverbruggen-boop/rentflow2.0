import type { Project, ProjectStatus } from "@/types";

/** Which projects the list shows: any subset of the five statuses. The
 * default ("Lopend") hides the finished/cancelled ones that otherwise bury
 * the current work. */
export type ProjectStatusFilter = ProjectStatus[];

export const ALL_STATUSES: ProjectStatus[] = ["concept", "bevestigd", "actief", "afgerond", "geannuleerd"];
export const OPEN_STATUSES: ProjectStatus[] = ["concept", "bevestigd", "actief"];

export const STATUS_LABELS: Record<ProjectStatus, string> = {
  concept: "Concept",
  bevestigd: "Bevestigd",
  actief: "Actief",
  afgerond: "Afgerond",
  geannuleerd: "Geannuleerd",
};

export function isOpenStatus(status: ProjectStatus): boolean {
  return OPEN_STATUSES.includes(status);
}

function sameSet(a: ProjectStatus[], b: ProjectStatus[]): boolean {
  return a.length === b.length && a.every((s) => b.includes(s));
}

/** `?status=concept,bevestigd` → statuses. Absent = Lopend (the default);
 * `all` or a value with no valid status = every status, so a mangled URL
 * never hides projects. Unknown entries are dropped. */
export function parseStatusParam(value: string | null): ProjectStatusFilter {
  if (value === null) return OPEN_STATUSES;
  if (value === "all") return ALL_STATUSES;
  const picked = ALL_STATUSES.filter((s) => value.split(",").includes(s));
  return picked.length > 0 ? picked : ALL_STATUSES;
}

/** Inverse of `parseStatusParam`; `null` means "drop the param" (default). */
export function serializeStatusParam(statuses: ProjectStatusFilter): string | null {
  if (sameSet(statuses, OPEN_STATUSES)) return null;
  if (sameSet(statuses, ALL_STATUSES)) return "all";
  return ALL_STATUSES.filter((s) => statuses.includes(s)).join(",");
}

/** Toggles one status. The last selected status can't be switched off —
 * an empty selection is meaningless. */
export function toggleStatus(statuses: ProjectStatusFilter, status: ProjectStatus): ProjectStatusFilter {
  if (!statuses.includes(status)) return ALL_STATUSES.filter((s) => s === status || statuses.includes(s));
  if (statuses.length === 1) return statuses;
  return statuses.filter((s) => s !== status);
}

function matchesStatus(p: Project, filter: ProjectStatusFilter): boolean {
  return filter.includes(p.status);
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
  return filterProjects(projects, ALL_STATUSES, query).length - filterProjects(projects, filter, query).length;
}
