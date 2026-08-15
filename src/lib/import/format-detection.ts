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
