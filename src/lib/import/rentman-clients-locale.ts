/**
 * B4 (round 3 PO feedback) — the `clients` counterpart to
 * rentman-locale.ts, following the same structure: a header-alias
 * table plus a translation function that is a no-op on anything it
 * doesn't recognise, safe to call unconditionally before format
 * detection.
 *
 * Unlike rentman-locale.ts, we do NOT have a confirmed real client
 * export to verify header spellings against (the PM was asked for one
 * and hasn't sent it — see .plans/2026-09-po-feedback-round3.md, B4).
 * Every entry in HEADER_ALIASES below is a best-effort guess at
 * Rentman's Dutch relations-export terminology, modelled on the
 * confirmed Dutch equipment-export style (capitalized, space-separated
 * headers). Confirm and extend against the real file once the PM sends
 * it: adding a spelling is a one-line addition to the table, nothing
 * else needs to change.
 *
 * Matching is case-insensitive, whitespace-normalized and
 * diacritic-folded (rentman-locale.ts's material table matches by exact
 * string instead) — deliberately looser here, since we're guessing at
 * spellings rather than working from a confirmed export.
 */

// The canonical, capitalized header names this module translates a
// recognised Dutch alias *to*. Distinct from both RentFlow's own
// lower-camel export headers ("name", "vatNumber", ...) and from the
// raw Dutch aliases below, so `format-detection.ts` can tell "this file
// used our own export" apart from "this file used a Rentman clients
// export" purely by header shape, the same way it does for materials.
export const CANONICAL_CLIENT_HEADERS = {
  name: "Name",
  contactName: "Contact person",
  email: "Email",
  phone: "Phone",
  address: "Address",
  postalCode: "Postal code",
  city: "City",
  vatNumber: "VAT number",
} as const;

export type CanonicalClientField = keyof typeof CANONICAL_CLIENT_HEADERS;

// Guessed Dutch/Rentman spellings (normalized via normalizeHeaderKey
// below) -> canonical field key above. EXTEND HERE once the real
// export's headers are known — this table is the only thing that needs
// to change.
const HEADER_ALIASES: Record<string, CanonicalClientField> = {
  naam: "name",
  "naam in database": "name",
  klant: "name",
  klantnaam: "name",
  bedrijfsnaam: "name",
  bedrijf: "name",
  relatienaam: "name",
  relatie: "name",
  contactpersoon: "contactName",
  "contact persoon": "contactName",
  contact: "contactName",
  email: "email",
  "e mail": "email",
  "e mailadres": "email",
  emailadres: "email",
  telefoon: "phone",
  telefoonnummer: "phone",
  tel: "phone",
  gsm: "phone",
  mobiel: "phone",
  adres: "address",
  straat: "address",
  "straat en huisnummer": "address",
  postcode: "postalCode",
  plaats: "city",
  woonplaats: "city",
  stad: "city",
  gemeente: "city",
  "btw nummer": "vatNumber",
  btwnummer: "vatNumber",
  ondernemingsnummer: "vatNumber",
  "vat number": "vatNumber",
  "vat nummer": "vatNumber",
};

// At least this many distinct aliased columns must be present before we
// call it a Rentman clients export — a single coincidental match (e.g.
// a stray "Stad" column) shouldn't be enough to reclassify the whole
// file. Mirrors the "distinctive anchor" principle of
// RENTMAN_ANCHOR_COLUMNS in format-detection.ts, just threshold-based
// instead of a fixed set, since we're matching by alias table rather
// than by exact known columns.
const ANCHOR_MIN_MATCHES = 2;

function normalizeHeaderKey(header: string): string {
  return header
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics (é -> e, ë -> e, ...)
    .toLowerCase()
    .replace(/[\s_-]+/g, " ")
    .trim();
}

/** True when enough headers look like a Rentman Dutch clients export to
 * be worth translating. Called before `normalizeRentmanClientsLocale`
 * so the latter stays a safe no-op on RentFlow's own export (whose
 * headers never match any alias) and on files we don't recognise at
 * all (left alone for the "unrecognised format" error message to
 * report honestly). */
export function looksLikeRentmanClientExport(headers: string[]): boolean {
  const matches = headers.filter((h) => HEADER_ALIASES[normalizeHeaderKey(h)] !== undefined);
  return matches.length >= ANCHOR_MIN_MATCHES;
}

/**
 * Translates a parsed file's headers (and row keys) from a recognised
 * Dutch Rentman clients export into the canonical header names above.
 * A no-op when `looksLikeRentmanClientExport` is false, and a no-op per
 * individual header it doesn't recognise even when it is true (so a
 * file with a mix of recognised and custom columns keeps the columns we
 * don't have an alias for, unchanged, rather than dropping them).
 */
export function normalizeRentmanClientsLocale(
  headers: string[],
  rows: Record<string, string>[],
): { headers: string[]; rows: Record<string, string>[] } {
  if (!looksLikeRentmanClientExport(headers)) return { headers, rows };

  const canonicalHeaders = headers.map((h) => {
    const field = HEADER_ALIASES[normalizeHeaderKey(h)];
    return field ? CANONICAL_CLIENT_HEADERS[field] : h;
  });

  const translatedRows = rows.map((row) => {
    const translated: Record<string, string> = {};
    headers.forEach((originalHeader, i) => {
      translated[canonicalHeaders[i]] = row[originalHeader];
    });
    return translated;
  });

  return { headers: canonicalHeaders, rows: translatedRows };
}
