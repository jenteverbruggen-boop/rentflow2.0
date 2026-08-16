import type { PrismaClient } from "@/generated/prisma/client";
import type { SourceFormat } from "@/lib/import/format-detection";

/**
 * P3.1 — the entity-agnostic shapes M1's own (materials-only, already
 * shipped) `ImportPreview`/`ImportRowPreview` in `material-preview.ts`
 * are widened to. `entity`/`mode` are unions here (`"materials"` was a
 * literal there); every concrete value M1 already produces still
 * satisfies this wider type, so M1's own tests need no change.
 */
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
  sourceFormat: SourceFormat;
  totals: { new: number; updated: number; unchanged: number; skipped: number; errored: number };
  rows: ImportRowPreview[];
  /** Present only for mode "replace"; a non-empty array means apply is
   * refused entirely — nothing is deleted or created (Q49b). */
  blockers?: ReplaceBlocker[];
  /** Replace mode only — every row of the current table, for the
   * mandatory "here is what gets deleted" preview (§5/§7.3). */
  toDelete?: { id: number; label: string }[];
}

export interface ParseRowError {
  line: number;
  reason: string;
}

export interface ApplyResult {
  created: number;
  updated: number;
  unchanged: number;
  deleted: number;
  errors: ParseRowError[];
}

/**
 * P3.1 — `EntityAdapter<T>` (design doc §4.1), adapted to the concrete
 * shape M1 already shipped rather than an idealised rewrite: every
 * pipeline stage calls the adapter, never re-implementing per-entity
 * logic inline (`pipeline.ts`). `T` is the row shape *after* parsing —
 * `ParsedMaterialRow` for materials, a parallel shape per new adapter.
 */
export interface EntityAdapter<T> {
  entity: ImportEntity;
  acceptedFormats: SourceFormat[];
  requiredHeaders: string[];
  matchKeyLabel: string;
  parseRows(rows: Record<string, string>[], format: SourceFormat): { parsed: T[]; errors: ParseRowError[] };
  matchKey(row: T): string | number | null;
  summarize(row: T): string;
  /** `null` classification input for a brand-new match key. */
  diffAgainstExisting(row: T, existing: T | null): { classification: ImportRowClassification; changes?: ImportRowChange[] };
  applyRow(tx: PrismaClient, row: T, ctx: Record<string, unknown>): Promise<"created" | "updated" | "unchanged">;
  /** A fresh mutable context object handed to every `applyRow` call in
   * one import — materials use it for a category-id cache and the
   * used-code set, per-entity adapters use whatever they need. */
  makeApplyContext(tx: PrismaClient): Promise<Record<string, unknown>>;
  fetchExisting(client: PrismaClient, keys: (string | number)[]): Promise<Map<string | number, T>>;
  /** Replace mode only. Every row currently in the table, for both the
   * mandatory delete-preview and the referential check below. */
  fetchAllForReplace(client: PrismaClient): Promise<{ id: number; label: string }[]>;
  referentialChecks(client: PrismaClient, ids: number[]): Promise<Map<number, BlockingReference[]>>;
  truncate(tx: PrismaClient): Promise<void>;
}
