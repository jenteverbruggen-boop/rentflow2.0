/** The non-money subhire columns on Material: default supplier, how that
 * supplier bills (per rental / per day) and whether the item is "inhuur-only"
 * (never stocked). The unit price is money and goes through
 * material-money-fields.ts. */
export function subhireFieldsData(body: Record<string, unknown>) {
  const supplier = body.defaultSupplierId;
  return {
    ...(supplier === null || Number.isInteger(supplier) ? { defaultSupplierId: supplier as number | null } : {}),
    ...(body.subhireCostBasis === "per_huur" || body.subhireCostBasis === "per_dag"
      ? { subhireCostBasis: body.subhireCostBasis }
      : {}),
    ...(body.subhireOnly !== undefined ? { subhireOnly: Boolean(body.subhireOnly) } : {}),
    // What the client pays: per day (default) or once per rental.
    ...(body.priceBasis === "per_huur" || body.priceBasis === "per_dag" ? { priceBasis: body.priceBasis } : {}),
  };
}

export interface CurrentSubhireState {
  defaultSupplierId: number | null;
  subhireOnly: boolean;
  isBundle?: boolean;
  /** Number of own stock items the material has. */
  stockCount?: number;
}

/** An inhuur-only item is always rented in, so it must say from whom —
 * otherwise booking it could never resolve its own shortage. It is also
 * exclusive with own stock and with being a set. Returns an error message, or
 * null when fine. `current` is the persisted row on an update. */
export function subhireFieldsError(
  body: Record<string, unknown>,
  current?: CurrentSubhireState | null,
): string | null {
  const wasOnly = current?.subhireOnly ?? false;
  const wasBundle = current?.isBundle ?? false;
  const onlyAfter = body.subhireOnly !== undefined ? Boolean(body.subhireOnly) : wasOnly;
  const bundleAfter = body.isBundle !== undefined ? Boolean(body.isBundle) : wasBundle;
  const supplierAfter =
    body.defaultSupplierId !== undefined ? (body.defaultSupplierId as number | null) : (current?.defaultSupplierId ?? null);
  if (onlyAfter && supplierAfter == null) return "Een inhuur-materiaal heeft een standaardleverancier nodig";
  // Only on the change itself: a legacy row must stay saveable.
  if (onlyAfter && !wasOnly && (current?.stockCount ?? 0) > 0) {
    return "Verwijder eerst de units — een inhuur-materiaal heeft geen eigen voorraad";
  }
  if (onlyAfter && bundleAfter && !(wasOnly && wasBundle)) return "Een set kan niet enkel-inhuur zijn";
  return null;
}

/** The named default supplier must exist and still be active — an archived one
 * would make every booking of an inhuur-only material fail. */
export async function supplierError(
  client: { supplier: { findUnique: (a: { where: { id: number } }) => Promise<{ archived: boolean } | null> } },
  body: Record<string, unknown>,
): Promise<string | null> {
  const id = body.defaultSupplierId;
  if (id === undefined || id === null) return null;
  if (!Number.isInteger(id)) return "Ongeldige leverancier";
  const supplier = await client.supplier.findUnique({ where: { id: id as number } });
  return !supplier || supplier.archived ? "Kies een leverancier die nog actief is" : null;
}
