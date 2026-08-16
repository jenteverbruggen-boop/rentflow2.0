/** P3.4 — the client-side mirror of pipeline-types.ts's server shapes
 * (that file imports server-only Prisma types, so the client bundle
 * needs its own copy of just the JSON-shaped parts). */
export type ImportEntity = "materials" | "people" | "clients" | "locations";
export type ImportMode = "update" | "replace";
export type ImportRowClassification = "new" | "updated" | "unchanged" | "skipped" | "errored";

export interface ImportRowChange {
  field: string;
  from: unknown;
  to: unknown;
}

export interface ImportRowPreview {
  line: number;
  classification: ImportRowClassification;
  matchKey: string | number | null;
  summary: string;
  changes?: ImportRowChange[];
  reason?: string;
}

export interface BlockingReference {
  relation: string;
  count: number;
}

export interface ReplaceBlocker {
  entityId: number | string;
  label: string;
  blockedBy: BlockingReference[];
}

export interface ImportPreview {
  entity: ImportEntity;
  mode: ImportMode;
  sourceFormat: string;
  totals: { new: number; updated: number; unchanged: number; skipped: number; errored: number };
  rows: ImportRowPreview[];
  blockers?: ReplaceBlocker[];
  toDelete?: { id: number; label: string }[];
}

export interface ImportApplyResult {
  created: number;
  updated: number;
  unchanged: number;
  deleted: number;
  errors: { line: number; reason: string }[];
}

export const ENTITY_LABELS: Record<ImportEntity, string> = {
  materials: "materialen",
  people: "personen",
  clients: "klanten",
  locations: "locaties",
};
