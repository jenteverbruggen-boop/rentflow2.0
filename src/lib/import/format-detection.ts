export type SourceFormat = "rentflow" | "rentman-equipment" | "rentman-clients" | "unknown";

// These four are distinctive enough that a false match against
// RentFlow's own plain-lowerCamel header set isn't realistic.
const RENTMAN_ANCHOR_COLUMNS = [
  "Code",
  "Folder (Folder)",
  "Stock calculation method",
  "Type of equipment",
];

// B4 (round 3 PO feedback) — the client counterpart. Checked against
// headers *after* normalizeRentmanClientsLocale has already translated
// any recognised Dutch aliases to these canonical names (see
// normalize-headers.ts), the same way RENTMAN_ANCHOR_COLUMNS above is
// checked post-translation. "Name" alone would collide with nothing in
// practice, but requiring it alongside one more distinctive column
// avoids a false positive on a one-off custom export that happens to
// have a column literally called "Name".
const RENTMAN_CLIENT_ANCHOR_COLUMNS = ["Name", "Contact person", "VAT number", "Postal code", "City", "Phone"];

const RENTFLOW_MATERIAL_REQUIRED = ["name", "code", "dayPrice"];

/**
 * M1.1 — classifies a file by its parsed header row, never by file
 * extension (Rentman ships .xlsx, but a user may re-save as .csv;
 * RentFlow's own export is .csv but a hand-edited copy might arrive as
 * .xlsx). Rejects before parsing any row when neither anchor set
 * matches, rather than attempting a partial/best-effort mapping.
 */
export function detectFormat(headers: string[]): Exclude<SourceFormat, "rentman-clients"> {
  const set = new Set(headers.map((h) => h.trim()));
  if (RENTMAN_ANCHOR_COLUMNS.every((c) => set.has(c))) return "rentman-equipment";
  if (RENTFLOW_MATERIAL_REQUIRED.every((c) => set.has(c))) return "rentflow";
  return "unknown";
}

/**
 * P3.1 — the generalised counterpart for the three new entities
 * (people/clients/locations only ever accept RentFlow's own layout,
 * design doc §3), checked against an adapter's own `requiredHeaders`
 * rather than the materials-only constant above. Materials keeps using
 * `detectFormat` directly (both from its own dedicated routes and via
 * this function, since `acceptedFormats` includes `rentman-equipment`)
 * — this is additive, `detectFormat` itself is untouched.
 */
export function detectEntityFormat(headers: string[], acceptedFormats: SourceFormat[], requiredHeaders: string[]): SourceFormat {
  const set = new Set(headers.map((h) => h.trim()));
  if (acceptedFormats.includes("rentman-equipment") && RENTMAN_ANCHOR_COLUMNS.every((c) => set.has(c))) {
    return "rentman-equipment";
  }
  if (
    acceptedFormats.includes("rentman-clients") &&
    set.has("Name") &&
    RENTMAN_CLIENT_ANCHOR_COLUMNS.filter((c) => c !== "Name").some((c) => set.has(c))
  ) {
    return "rentman-clients";
  }
  if (acceptedFormats.includes("rentflow") && requiredHeaders.every((c) => set.has(c))) {
    return "rentflow";
  }
  return "unknown";
}

/**
 * B4 (round 3 PO feedback) — the previous rejection message
 * ("verwacht kolommen: name") only ever named the requirement, never
 * what the file actually contained. That left the user (and us, from
 * their bug report) unable to tell whether their file was missing a
 * column, misspelled one, or was entirely the wrong shape. This reports
 * both halves so a rejection is self-diagnosable and, when reported
 * back to us, tells us exactly which header spelling to add to the
 * relevant alias table (rentman-locale.ts / rentman-clients-locale.ts).
 */
export function describeUnrecognizedFormat(headers: string[], requiredHeaders: string[]): string {
  const found = headers.map((h) => h.trim()).filter(Boolean);
  const foundSet = new Set(found);
  const missing = requiredHeaders.filter((h) => !foundSet.has(h));
  const foundText = found.length > 0 ? found.join(", ") : "(geen kolommen gevonden)";
  const missingText = missing.length > 0 ? missing.join(", ") : requiredHeaders.join(", ");
  return (
    `Onherkend bestandsformaat. Gevonden kolommen: ${foundText}. ` +
    `Verwachte kolommen die ontbreken: ${missingText}.`
  );
}
