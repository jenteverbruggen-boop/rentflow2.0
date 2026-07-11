interface ComponentInput {
  parentId: number;
  parentName: string;
  childId: number;
}

export function computeSharingMap(
  components: ComponentInput[],
): Map<number, { id: number; name: string }[]> {
  const map = new Map<number, { id: number; name: string }[]>();
  for (const c of components) {
    if (!map.has(c.childId)) map.set(c.childId, []);
    map.get(c.childId)!.push({ id: c.parentId, name: c.parentName });
  }
  return map;
}
