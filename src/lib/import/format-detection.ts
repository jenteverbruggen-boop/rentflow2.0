export type SourceFormat = "rentflow" | "rentman-equipment" | "unknown";

// These four are distinctive enough that a false match against
// RentFlow's own plain-lowerCamel header set isn't realistic.
const RENTMAN_ANCHOR_COLUMNS = [
  "Code",
  "Folder (Folder)",
  "Stock calculation method",
  "Type of equipment",
];

const RENTFLOW_MATERIAL_REQUIRED = ["name", "code", "dayPrice"];

/**
 * M1.1 — classifies a file by its parsed header row, never by file
 * extension (Rentman ships .xlsx, but a user may re-save as .csv;
 * RentFlow's own export is .csv but a hand-edited copy might arrive as
 * .xlsx). Rejects before parsing any row when neither anchor set
 * matches, rather than attempting a partial/best-effort mapping.
 */
export function detectFormat(headers: string[]): SourceFormat {
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
  if (acceptedFormats.includes("rentflow") && requiredHeaders.every((c) => set.has(c))) {
    return "rentflow";
  }
  return "unknown";
}
