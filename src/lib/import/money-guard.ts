import type { ResolvedAccess } from "@/lib/api-auth";
import { satisfies } from "@/lib/modules";
import { moneyVisible } from "@/lib/redact";
import type { ImportEntity, ImportPreview } from "@/lib/import/pipeline-types";

/**
 * Money-shaped columns a bulk import can read/write, per entity —
 * mirrors the money columns each `*-export.ts` (P2) conditionally
 * includes. Found by review: neither the preview nor the apply side of
 * the import pipeline (P3) had ever applied this project's own
 * Kosten/Facturen money rule, even though every other read/write
 * surface does.
 */
const MONEY_FIELDS_BY_ENTITY: Record<ImportEntity, string[]> = {
  materials: ["dayPrice", "costPrice", "listPrice"],
  people: ["dayPrice"],
  clients: [],
  locations: [],
};

/**
 * A preview row's `changes[].from` is the row's *current database
 * value* — exactly what `redactMoney` (src/lib/redact.ts) exists to
 * hide for a caller without `Kosten/Facturen: lezen`, but that
 * function's key-name-based denylist doesn't fit this shape (the wire
 * keys are `field`/`from`/`to`, not `dayPrice` itself). This is the
 * dedicated equivalent for import previews: strips money-field changes
 * entirely, never blanks them, same "omit, don't null" convention P2's
 * exports use.
 */
export function redactPreviewMoney(preview: ImportPreview, access: ResolvedAccess): ImportPreview {
  const moneyFields = MONEY_FIELDS_BY_ENTITY[preview.entity];
  if (moneyFields.length === 0 || moneyVisible(access)) return preview;
  const denylist = new Set(moneyFields);
  return {
    ...preview,
    rows: preview.rows.map((row) =>
      row.changes ? { ...row, changes: row.changes.filter((c) => !denylist.has(c.field)) } : row,
    ),
  };
}

/**
 * Refuses a bulk import outright when the uploaded file's own header
 * row contains a money-shaped column and the caller lacks
 * `Kosten/Facturen: wijzigen` — mirrors `findRejectedMoneyWrite`'s
 * single-record behaviour (`POST /api/materials` refuses the whole
 * request if `dayPrice` is present in the body under the same
 * condition) rather than silently importing every other field and
 * dropping just the price. Returns the offending header name, or
 * `null` if the import may proceed.
 */
export function rejectedMoneyImportHeader(
  entity: ImportEntity,
  headers: string[],
  access: ResolvedAccess,
): string | null {
  if (satisfies(access.permissions.kosten_facturen ?? "geen", "wijzigen")) return null;
  const set = new Set(headers.map((h) => h.trim()));
  return MONEY_FIELDS_BY_ENTITY[entity].find((f) => set.has(f)) ?? null;
}
