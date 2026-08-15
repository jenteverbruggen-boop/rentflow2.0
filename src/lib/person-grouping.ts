import type { PeriodPerson, PersonAvailability } from "@/types";

/** Group the "available to add" list by role, extracted from
 * person-split-editor.tsx (Y3.3) — pure move, no behaviour change. */
export function groupAvailableByRole(
  items: PersonAvailability[],
): [string, PersonAvailability[]][] {
  const map = new Map<string, PersonAvailability[]>();
  for (const p of items) {
    const role = p.person.role ?? "Overig";
    if (!map.has(role)) map.set(role, []);
    map.get(role)!.push(p);
  }
  return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
}

/** Group the "already assigned" list by role, extracted from
 * person-split-editor.tsx (Y3.3) — pure move, no behaviour change. */
export function groupAssignedByRole(
  people: PeriodPerson[],
): [string, PeriodPerson[]][] {
  const map = new Map<string, PeriodPerson[]>();
  for (const pp of people) {
    const role = pp.role ?? pp.person.role ?? "Overig";
    if (!map.has(role)) map.set(role, []);
    map.get(role)!.push(pp);
  }
  return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
}
