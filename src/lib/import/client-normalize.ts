/**
 * B4 (round 3 PO feedback) — normalization helpers for the client
 * fallback match key (client.ts's `matchKey`/`applyRow`). A foreign
 * export never carries our own `Client.id`, so matching falls back to
 * VAT number, then email, then name — but only once these are
 * normalized do two spellings of "the same" value actually compare
 * equal. Pure functions, unit-tested directly.
 */

/** Strips dots, spaces and hyphens and upper-cases, so "BE 0123.456.789",
 * "be0123456789" and "BE-0123-456-789" all normalize to the same key. */
export function normalizeVat(vat: string | null | undefined): string | null {
  if (!vat) return null;
  const stripped = vat.replace(/[.\s-]/g, "").toUpperCase();
  return stripped.length > 0 ? stripped : null;
}

/** Trims and lower-cases — email comparison is case-insensitive by RFC
 * convention for the domain part, and in practice for the local part
 * too for every provider a client is realistically hosted with. */
export function normalizeEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const trimmed = email.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

/** Collapses internal whitespace runs to a single space, trims, and
 * case-folds — "Acme   BV", " acme bv" and "ACME BV" all normalize to
 * "acme bv". Name is the last, weakest fallback (see client-match.ts)
 * precisely because it is the most likely to collide across unrelated
 * clients — only reached when neither VAT nor email is present. */
export function normalizeName(name: string | null | undefined): string | null {
  if (!name) return null;
  const collapsed = name.trim().replace(/\s+/g, " ").toLowerCase();
  return collapsed.length > 0 ? collapsed : null;
}
