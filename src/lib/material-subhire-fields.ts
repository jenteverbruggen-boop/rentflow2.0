/** The non-money subhire columns on Material: default supplier, how that
 * supplier bills (per rental / per day) and whether the item is "inhuur-only"
 * (never stocked). The unit price is money and goes through
 * material-money-fields.ts. */
export function subhireFieldsData(body: Record<string, unknown>) {
  const supplier = body.defaultSupplierId;
  return {
    ...(supplier !== undefined ? { defaultSupplierId: supplier === null ? null : Number(supplier) } : {}),
    ...(body.subhireCostBasis === "per_huur" || body.subhireCostBasis === "per_dag"
      ? { subhireCostBasis: body.subhireCostBasis }
      : {}),
    ...(body.subhireOnly !== undefined ? { subhireOnly: Boolean(body.subhireOnly) } : {}),
  };
}

/** An inhuur-only item is always rented in, so it must say from whom —
 * otherwise booking it could never resolve its own shortage. Returns an error
 * message, or null when fine. `current` is the persisted row on an update. */
export function subhireFieldsError(
  body: Record<string, unknown>,
  current?: { defaultSupplierId: number | null; subhireOnly: boolean } | null,
): string | null {
  const onlyAfter = body.subhireOnly !== undefined ? Boolean(body.subhireOnly) : (current?.subhireOnly ?? false);
  const supplierAfter =
    body.defaultSupplierId !== undefined ? (body.defaultSupplierId as number | null) : (current?.defaultSupplierId ?? null);
  return onlyAfter && supplierAfter == null ? "Een inhuur-materiaal heeft een standaardleverancier nodig" : null;
}
