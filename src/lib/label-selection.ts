// B5 — the material label picker's select-all and print-set logic,
// extracted so it can be unit tested without mounting the page.
//
// `selectedIds` is always the full source of truth: it may contain ids
// that are not currently visible under the active filter (the user
// picked them, then changed the filter). Neither of these functions may
// discard those ids — they only ever add to / read from the set.

export function toggleAllInSelection(
  selectedIds: Set<number>,
  visibleIds: number[],
): Set<number> {
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));

  const next = new Set(selectedIds);
  if (allVisibleSelected) {
    for (const id of visibleIds) next.delete(id);
  } else {
    for (const id of visibleIds) next.add(id);
  }
  return next;
}

export function resolveLabelMaterials<T extends { id: number }>(
  allMaterials: T[],
  filteredMaterials: T[],
  selectedIds: Set<number>,
): T[] {
  if (selectedIds.size === 0) return filteredMaterials;
  return allMaterials.filter((m) => selectedIds.has(m.id));
}
