import type { MaterialAvailability } from "@/types";
import type { MaterialGroup } from "@/lib/grouping";

/** Group the "available to add" list by category, extracted from
 * material-split-editor.tsx (Y3.6) — pure move, no behaviour change. */
export function groupAvailableByCategory(
  items: MaterialAvailability[],
): [string, MaterialAvailability[]][] {
  const map = new Map<string, MaterialAvailability[]>();
  for (const m of items) {
    const cat = m.material.category ?? "Overig";
    if (!map.has(cat)) map.set(cat, []);
    map.get(cat)!.push(m);
  }
  return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
}

/** Group the "already assigned" material groups by category, extracted
 * from material-split-editor.tsx (Y3.6) — pure move, no behaviour change. */
export function groupAssignedByCategory(
  groups: MaterialGroup[],
): [string, MaterialGroup[]][] {
  const map = new Map<string, MaterialGroup[]>();
  for (const g of groups) {
    const cat = g.material.category ?? "Overig";
    if (!map.has(cat)) map.set(cat, []);
    map.get(cat)!.push(g);
  }
  return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
}
