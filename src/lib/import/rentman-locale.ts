/**
 * M1.x — Rentman's equipment export carries different column headers
 * and enum-style cell values depending on the source system's own UI
 * language (English vs. Dutch); the row/column shape is otherwise
 * identical. `format-detection.ts` and `rentman-material-parser.ts`
 * both match against the English strings, so a Dutch-language export
 * fails `detectFormat` outright (as "unknown") rather than importing
 * with blank fields. This translates a Dutch export back to the
 * canonical English strings before either of those run — a no-op on an
 * already-English Rentman export and on RentFlow's own lower-camel CSV
 * headers, since neither matches any alias below.
 */

// Only the headers that either gate format detection (the
// RENTMAN_ANCHOR_COLUMNS in format-detection.ts) or are actually read by
// rentman-material-parser.ts need an alias — translating columns
// RentFlow never consumes would just be dead weight.
const HEADER_ALIASES: Record<string, string> = {
  "Map (Map)": "Folder (Folder)",
  "Methode voorraadberekening": "Stock calculation method",
  "Type materiaal": "Type of equipment",
  "Naam (in database)": "Name (in database)",
  "Verhuur-/verkoopprijs": "Rental-/Sales price",
  Margeprijs: "Margin price",
  Nieuwprijs: "List price",
  "Opmerking intern": "Internal remark",
  "Huidig aantal": "Current quantity",
  Gearchiveerd: "Archived",
  "Weergeven in planner": "Display in planner",
  "Fabrikant serienummer (Exemplaar)": "Manufacturer serial number (Serial number)",
  "Weergavenaam (Exemplaar)": "Display name (Serial number)",
  "Interne referentie (Exemplaar)": "Internal reference (Serial number)",
  "Actief (Exemplaar)": "Active (Serial number)",
  "Opmerking (Exemplaar)": "Remark (Serial number)",
};

// Enum-style cell values that rentman-material-parser.ts compares by
// exact string, keyed by the (already header-translated) English column
// name they live in.
const VALUE_ALIASES: Record<string, Record<string, string>> = {
  "Type of equipment": {
    "Fysiek item": "Physical item",
    "Fysieke combinatie": "Physical combination",
    "Virtuele combinatie": "Virtual combination",
  },
  "Stock calculation method": {
    Geserialiseerd: "Serialized",
  },
};

/**
 * Translates a parsed file's headers and row values from Rentman's
 * Dutch export strings to the canonical English ones the rest of the
 * import pipeline expects. Safe to call unconditionally, before
 * `detectFormat`/`detectEntityFormat` — it only ever rewrites strings
 * this module recognises as Dutch aliases.
 */
export function normalizeRentmanLocale(
  headers: string[],
  rows: Record<string, string>[],
): { headers: string[]; rows: Record<string, string>[] } {
  const canonicalHeaders = headers.map((h) => HEADER_ALIASES[h] ?? h);

  const translatedRows = rows.map((row) => {
    const translated: Record<string, string> = {};
    headers.forEach((originalHeader, i) => {
      const canonicalHeader = canonicalHeaders[i];
      const value = row[originalHeader];
      const valueAliases = VALUE_ALIASES[canonicalHeader];
      translated[canonicalHeader] = valueAliases?.[value] ?? value;
    });
    return translated;
  });

  return { headers: canonicalHeaders, rows: translatedRows };
}
