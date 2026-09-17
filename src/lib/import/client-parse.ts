import type { ParseRowError } from "@/lib/import/pipeline-types";
import { CANONICAL_CLIENT_HEADERS, type CanonicalClientField } from "@/lib/import/rentman-clients-locale";

export interface ParsedClientRow {
  line: number;
  id: number | null;
  name: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  postalCode: string | null;
  city: string | null;
  vatNumber: string | null;
  notes: string | null;
}

export const CLIENT_FIELDS: (keyof ParsedClientRow)[] = [
  "name",
  "contactName",
  "email",
  "phone",
  "address",
  "postalCode",
  "city",
  "vatNumber",
  "notes",
];

/**
 * B4 (round 3 PO feedback) — `rentman-clients` rows arrive already
 * translated to the canonical capitalized headers (see
 * rentman-clients-locale.ts, run before this adapter ever sees the
 * rows), `rentflow` rows carry our own lower-camel headers directly.
 * Neither carries an `id` we can trust for a foreign row — only
 * RentFlow's own export column is ever read into `id`.
 */
function readField(row: Record<string, string>, format: string, field: CanonicalClientField): string {
  if (format === "rentman-clients") return row[CANONICAL_CLIENT_HEADERS[field]] ?? "";
  return row[field] ?? "";
}

export function parseClientRows(rows: Record<string, string>[], format: string): { parsed: ParsedClientRow[]; errors: ParseRowError[] } {
  const parsed: ParsedClientRow[] = [];
  const errors: ParseRowError[] = [];
  rows.forEach((row, i) => {
    const line = i + 2;
    const name = readField(row, format, "name").trim();
    if (!name) {
      errors.push({ line, reason: "geen naam" });
      return;
    }
    // A foreign export's own internal id (if any) is never our
    // Client.id — only trust an `id` column under RentFlow's own
    // format. B4's fallback match key exists precisely for every other
    // case.
    const rawId = format === "rentflow" ? (row.id ?? "").trim() : "";
    const id = rawId ? Number(rawId) : null;
    if (rawId && !Number.isFinite(id)) {
      errors.push({ line, reason: "ongeldige id" });
      return;
    }
    parsed.push({
      line,
      id,
      name,
      contactName: readField(row, format, "contactName").trim() || null,
      email: readField(row, format, "email").trim() || null,
      phone: readField(row, format, "phone").trim() || null,
      address: readField(row, format, "address").trim() || null,
      postalCode: readField(row, format, "postalCode").trim() || null,
      city: readField(row, format, "city").trim() || null,
      vatNumber: readField(row, format, "vatNumber").trim() || null,
      notes: format === "rentflow" ? (row.notes ?? "").trim() || null : null,
    });
  });
  return { parsed, errors };
}
