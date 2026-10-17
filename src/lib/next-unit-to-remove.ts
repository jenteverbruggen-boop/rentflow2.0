import type { MaterialGroup } from "@/lib/grouping";

export type UnitToRemove =
  | { kind: "open"; shortageId: number }
  | { kind: "hired"; shortageId: number }
  | { kind: "owned"; assignmentId: number };

/** What the "−" button takes away first: an open (overbooked) unit, then a
 * hired-in unit, then an owned one. `null` when the group is empty. */
export function nextUnitToRemove(
  group: Pick<MaterialGroup, "overbookedUnits" | "shortageIds" | "subhireIds" | "assignments">,
): UnitToRemove | null {
  if (group.overbookedUnits > 0 && group.shortageIds.length > 0) {
    return { kind: "open", shortageId: group.shortageIds[group.shortageIds.length - 1] };
  }
  if (group.subhireIds.length > 0) {
    return { kind: "hired", shortageId: group.subhireIds[group.subhireIds.length - 1] };
  }
  const last = group.assignments[group.assignments.length - 1];
  return last ? { kind: "owned", assignmentId: last.id } : null;
}
