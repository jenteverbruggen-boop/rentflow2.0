/**
 * Belgian structured communication ("gestructureerde mededeling", OGM/VCS):
 * `+++XXX/XXXX/XXXXX+++` — ten digits plus a two-digit check, the remainder
 * of those ten digits modulo 97 (a remainder of 0 is written as 97).
 *
 * The ten digits are the invoice's year (4) and its sequence number (6), so
 * the reference is derived from the legal number's own parts — never from
 * parsing the configurable number format, and not from the database id.
 */
export function structuredReference(year: number, seq: number): string {
  if (!Number.isInteger(year) || year < 1000 || year > 9999) throw new Error(`Ongeldig jaar: ${year}`);
  if (!Number.isInteger(seq) || seq < 1 || seq > 999_999) throw new Error(`Volgnummer buiten bereik: ${seq}`);
  const base = `${year}${String(seq).padStart(6, "0")}`;
  const rest = Number(base) % 97;
  const digits = `${base}${String(rest === 0 ? 97 : rest).padStart(2, "0")}`;
  return `+++${digits.slice(0, 3)}/${digits.slice(3, 7)}/${digits.slice(7)}+++`;
}

/** True when `reference` is a well-formed OGM whose check digits match. */
export function isValidStructuredReference(reference: string): boolean {
  const m = reference.match(/^\+\+\+(\d{3})\/(\d{4})\/(\d{5})\+\+\+$/);
  if (!m) return false;
  const digits = `${m[1]}${m[2]}${m[3]}`;
  const rest = Number(digits.slice(0, 10)) % 97;
  return Number(digits.slice(10)) === (rest === 0 ? 97 : rest);
}
