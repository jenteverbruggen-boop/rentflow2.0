/**
 * Compute the add/remove sets for a person's function assignments,
 * given the ids already on the row and the ids the client just sent.
 *
 * L1.1: `PUT /api/people/[id]` used to `deleteMany: {} + create` the
 * whole set on every save — harmless while PersonFunction was a bare
 * junction, but since DDL-2 added a per-person rate override to that
 * row, a blanket delete+recreate silently wipes every rate override on
 * any save that merely edits an unrelated field (e.g. the phone
 * number). A pure diff, unchanged ids are never touched, so their rate
 * rows survive.
 */
export function diffFunctionIds(
  existingIds: number[],
  nextIds: number[],
): { toAdd: number[]; toRemove: number[] } {
  const toAdd = nextIds.filter((id) => !existingIds.includes(id));
  const toRemove = existingIds.filter((id) => !nextIds.includes(id));
  return { toAdd, toRemove };
}
