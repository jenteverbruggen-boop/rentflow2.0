import type { ParsedMaterialRow, MaterialParseError } from "@/lib/import/material-adapter";

export interface ImportRowChange {
  field: string;
  from: unknown;
  to: unknown;
}

export interface ImportRowPreview {
  line: number;
  classification: "new" | "updated" | "unchanged" | "skipped" | "errored";
  matchKey: string | number | null;
  summary: string;
  changes?: ImportRowChange[];
  reason?: string;
}

export interface ImportPreview {
  entity: "materials";
  mode: "update";
  sourceFormat: "rentflow" | "rentman-equipment";
  totals: { new: number; updated: number; unchanged: number; skipped: number; errored: number };
  rows: ImportRowPreview[];
}

export interface ExistingMaterial {
  code: string;
  name: string;
  dayPrice: number;
  costPrice: number | null;
  listPrice: number | null;
  isBundle: boolean;
  archived: boolean;
  notes: string | null;
}

const FIELDS: (keyof ExistingMaterial)[] = [
  "name",
  "dayPrice",
  "costPrice",
  "listPrice",
  "isBundle",
  "archived",
  "notes",
];

/** Exported for P3.1's `EntityAdapter<ParsedMaterialRow>` wrapper. */
export function diffMaterialRow(parsed: ParsedMaterialRow, existing: ExistingMaterial): ImportRowChange[] {
  const changes: ImportRowChange[] = [];
  const candidate: ExistingMaterial = {
    code: parsed.code ?? "",
    name: parsed.name,
    dayPrice: parsed.dayPrice,
    costPrice: parsed.costPrice,
    listPrice: parsed.listPrice,
    isBundle: parsed.isBundle,
    archived: parsed.archived,
    notes: parsed.notes,
  };
  for (const field of FIELDS) {
    if (candidate[field] !== existing[field]) {
      changes.push({ field, from: existing[field], to: candidate[field] });
    }
  }
  return changes;
}

/**
 * M1.2 — classifies each parsed row against the current database state
 * (matched by `code`, Q36a) without writing anything. `existingByCode`
 * is fetched once by the caller (the route) so this stays a pure,
 * easily-tested function.
 */
export function buildMaterialPreview(
  materials: ParsedMaterialRow[],
  parseErrors: MaterialParseError[],
  existingByCode: Map<string, ExistingMaterial>,
  sourceFormat: "rentflow" | "rentman-equipment",
): ImportPreview {
  const rows: ImportRowPreview[] = [];

  for (const parsed of materials) {
    const summary = `${parsed.name}${parsed.code ? ` (${parsed.code})` : ""}`;
    const existing = parsed.code ? existingByCode.get(parsed.code) : undefined;
    if (!existing) {
      rows.push({ line: parsed.line, classification: "new", matchKey: parsed.code, summary });
      continue;
    }
    const changes = diffMaterialRow(parsed, existing);
    rows.push({
      line: parsed.line,
      classification: changes.length > 0 ? "updated" : "unchanged",
      matchKey: parsed.code,
      summary,
      changes: changes.length > 0 ? changes : undefined,
    });
  }

  for (const error of parseErrors) {
    rows.push({
      line: error.line,
      classification: "skipped",
      matchKey: null,
      summary: `regel ${error.line}`,
      reason: error.reason,
    });
  }

  rows.sort((a, b) => a.line - b.line);

  const totals = {
    new: rows.filter((r) => r.classification === "new").length,
    updated: rows.filter((r) => r.classification === "updated").length,
    unchanged: rows.filter((r) => r.classification === "unchanged").length,
    skipped: rows.filter((r) => r.classification === "skipped").length,
    errored: rows.filter((r) => r.classification === "errored").length,
  };

  return { entity: "materials", mode: "update", sourceFormat, totals, rows };
}
