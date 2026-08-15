import type { SourceFormat } from "@/lib/import/format-detection";
import { parseRentmanRows } from "@/lib/import/rentman-material-parser";

export interface ParsedMaterialRow {
  line: number;
  externalId: string | null;
  code: string | null;
  name: string;
  categoryName: string | null;
  categoryPrefix: string | null;
  dayPrice: number;
  costPrice: number | null;
  listPrice: number | null;
  isBundle: boolean;
  archived: boolean;
  notes: string | null;
  stockItems: { identifier: string | null; notes: string | null }[];
}

export interface MaterialParseError {
  line: number;
  reason: string;
}

function parseNumber(value: string | undefined): number | null {
  const raw = (value ?? "").trim();
  if (!raw) return null;
  const normalized = raw.replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

/** M1.1 — RentFlow's own round-trip layout (Q56): plain field names, no
 * grouping needed (one row = one material). No real export exists yet
 * (P2, phase 4) to test this against, but the shape is fixed now so
 * that future work doesn't redefine the contract. */
function parseRentflowRows(rows: Record<string, string>[]): {
  materials: ParsedMaterialRow[];
  errors: MaterialParseError[];
} {
  const materials: ParsedMaterialRow[] = [];
  const errors: MaterialParseError[] = [];
  rows.forEach((row, i) => {
    const line = i + 2;
    const name = (row.name ?? "").trim();
    if (!name) {
      errors.push({ line, reason: "geen naam" });
      return;
    }
    materials.push({
      line,
      externalId: (row.id ?? "").trim() || null,
      code: (row.code ?? "").trim() || null,
      name,
      categoryName: (row.category ?? "").trim() || null,
      categoryPrefix: (row.categoryPrefix ?? "").trim() || null,
      dayPrice: parseNumber(row.dayPrice) ?? 0,
      costPrice: parseNumber(row.costPrice),
      listPrice: parseNumber(row.listPrice),
      isBundle: (row.isBundle ?? "").trim().toLowerCase() === "true",
      archived: (row.archived ?? "").trim().toLowerCase() === "true",
      notes: (row.notes ?? "").trim() || null,
      stockItems: Array.from(
        { length: Math.max(0, parseInt(row.stockCount ?? "0", 10) || 0) },
        () => ({ identifier: null, notes: null }),
      ),
    });
  });
  return { materials, errors };
}

export function parseMaterialRows(
  rows: Record<string, string>[],
  format: SourceFormat,
): { materials: ParsedMaterialRow[]; errors: MaterialParseError[] } {
  if (format === "rentman-equipment") return parseRentmanRows(rows);
  if (format === "rentflow") return parseRentflowRows(rows);
  throw new Error(`Onbekend importformaat: ${format}`);
}
