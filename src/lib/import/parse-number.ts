/**
 * Parses a price/quantity cell. A comma means Dutch notation ("1.234,56":
 * dots are thousands separators); without one the value is plain ("0.38",
 * as English Rentman exports and xlsx numeric cells write it).
 */
export function parseNumber(value: string | undefined): number | null {
  const raw = (value ?? "").trim();
  if (!raw) return null;
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}
