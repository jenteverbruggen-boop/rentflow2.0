// B3 — once a material has a categoryId, the legacy `category` string
// must stop drifting from it: every display surface reads
// `categoryRel?.name ?? category`, so a stale legacy string is
// invisible but still wrong data at rest. When a categoryId is set,
// the resolved category row's name always wins over whatever legacy
// string the caller submitted; only a material with no categoryId at
// all keeps writing the plain legacy string (unmigrated materials,
// covered separately by the deferred backfill).
export function resolveLegacyCategoryName(
  categoryId: number | null | undefined,
  submittedCategory: string | null | undefined,
  resolvedCategoryName: string | null | undefined,
): string | null {
  if (categoryId != null) return resolvedCategoryName ?? null;
  return submittedCategory ?? null;
}
