import { normalizeVat, normalizeEmail, normalizeName } from "@/lib/import/client-normalize";

/**
 * B4 (round 3 PO feedback) — the fallback match-key chain for client
 * import. Before this, `client.ts`'s `matchKey` was `row.id` alone: a
 * RentFlow-internal id no foreign export ever contains, so every row
 * from a real customer file classified as "new" and every re-import
 * created a full duplicate set (pipeline.ts drops null keys from the
 * lookup entirely). This is the shared logic behind `matchKey`,
 * `fetchExisting` and `applyRow` in adapters/client.ts, so the three
 * can never drift out of sync with each other.
 *
 * Priority, applied only when `id` is absent: normalized VAT number →
 * normalized email → normalized name. VAT/email are far less likely to
 * collide across unrelated clients than name, hence the order.
 */
export type ClientMatchField = "id" | "vatNumber" | "email" | "name";

export interface ClientMatchable {
  id: number | null;
  name: string;
  email: string | null;
  vatNumber: string | null;
}

/** The prefix-encoded map key a non-id match produces, e.g. "vat:BE123".
 * Only client.ts's own matchKey/fetchExisting interpret this encoding —
 * pipeline.ts treats every adapter's matchKey as an opaque string|number. */
function encode(field: Exclude<ClientMatchField, "id">, value: string): string {
  return `${field}:${value}`;
}

/** The row-side half: what key would this parsed row match on. Returns
 * `null` when no field is usable at all (no id, no VAT, no email, no
 * name — the row itself would already have failed "geen naam" earlier
 * in parseRows, so this is mostly defensive). */
export function resolveClientMatchKey(row: ClientMatchable): string | number | null {
  if (row.id != null) return row.id;
  const vat = normalizeVat(row.vatNumber);
  if (vat) return encode("vatNumber", vat);
  const email = normalizeEmail(row.email);
  if (email) return encode("email", email);
  const name = normalizeName(row.name);
  if (name) return encode("name", name);
  return null;
}

/** Which field a match was actually found on — surfaced in the preview
 * (`ImportRowPreview.matchField`) so the user can see *why* a row is an
 * update rather than a create, per the round-3 fix plan. Only
 * meaningful once a match exists; safe to call unconditionally. */
export function resolveClientMatchField(row: ClientMatchable): ClientMatchField | undefined {
  if (row.id != null) return "id";
  if (normalizeVat(row.vatNumber)) return "vatNumber";
  if (normalizeEmail(row.email)) return "email";
  if (normalizeName(row.name)) return "name";
  return undefined;
}

/** The DB-side half: given every existing client row, index it under
 * every key a future import row could plausibly match it on (its own
 * id, plus its normalized VAT/email/name if present) — not just the
 * one the *current* file's rows happen to use, since different re-import
 * files may carry different fallback fields for the same client. */
export function indexExistingClientsByMatchKey<T extends ClientMatchable>(
  clients: T[],
): Map<string | number, T> {
  const map = new Map<string | number, T>();
  for (const c of clients) {
    map.set(c.id as number, c);
    const vat = normalizeVat(c.vatNumber);
    if (vat) map.set(encode("vatNumber", vat), c);
    const email = normalizeEmail(c.email);
    if (email) map.set(encode("email", email), c);
    const name = normalizeName(c.name);
    if (name) map.set(encode("name", name), c);
  }
  return map;
}

/** Single-row lookup against an already-fetched client list — used by
 * `applyRow`, which (unlike `fetchExisting`) only ever needs one match
 * at a time but must apply the exact same priority chain. */
export function findExistingClientMatch<T extends ClientMatchable>(
  row: ClientMatchable,
  existingClients: T[],
): T | null {
  if (row.id != null) return existingClients.find((c) => c.id === row.id) ?? null;
  const vat = normalizeVat(row.vatNumber);
  if (vat) {
    const match = existingClients.find((c) => normalizeVat(c.vatNumber) === vat);
    if (match) return match;
  }
  const email = normalizeEmail(row.email);
  if (email) {
    const match = existingClients.find((c) => normalizeEmail(c.email) === email);
    if (match) return match;
  }
  const name = normalizeName(row.name);
  if (name) {
    const match = existingClients.find((c) => normalizeName(c.name) === name);
    if (match) return match;
  }
  return null;
}
