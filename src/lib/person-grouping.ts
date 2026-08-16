import type { PeriodPerson, PersonAvailability } from "@/types";

/** L4.1 — the legacy free-text `Person.role`/`PeriodPerson.role` fields
 * are gone; grouping now reads the real `Function` relation (L2)
 * everywhere instead. */

/** Group the "available to add" list by the person's first linked
 * function — a person not yet assigned a function falls into "Overig",
 * same as before when they had no legacy role text. */
export function groupAvailableByRole(
  items: PersonAvailability[],
): [string, PersonAvailability[]][] {
  const map = new Map<string, PersonAvailability[]>();
  for (const p of items) {
    const role = p.person.functions?.[0]?.function?.name ?? "Overig";
    if (!map.has(role)) map.set(role, []);
    map.get(role)!.push(p);
  }
  return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
}

/** Group the "already assigned" list by the function chosen at booking
 * time (L2's `PeriodPerson.function`), falling back to the person's
 * first linked function when none was chosen. */
export function groupAssignedByRole(
  people: PeriodPerson[],
): [string, PeriodPerson[]][] {
  const map = new Map<string, PeriodPerson[]>();
  for (const pp of people) {
    const role = pp.function?.name ?? pp.person.functions?.[0]?.function?.name ?? "Overig";
    if (!map.has(role)) map.set(role, []);
    map.get(role)!.push(pp);
  }
  return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
}
