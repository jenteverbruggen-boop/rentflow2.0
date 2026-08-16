import type { PrismaClient } from "@/generated/prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import type { SourceFormat } from "@/lib/import/format-detection";
import type {
  EntityAdapter,
  ImportPreview,
  ImportRowPreview,
  ImportMode,
  ApplyResult,
  ReplaceBlocker,
} from "@/lib/import/pipeline-types";

/**
 * P3.1 — the shared parse → preview → apply engine (design doc §4).
 * Every stage calls the adapter; nothing here is per-entity. Mirrors
 * M1.2's `buildMaterialPreview` shape exactly, generalised to any
 * adapter — M1's own function is untouched and still used by its own
 * (now-thin) call site, so its tests keep exercising real production
 * code, not a parallel reimplementation.
 */
export async function buildImportPreview<T>(
  adapter: EntityAdapter<T>,
  rows: Record<string, string>[],
  format: SourceFormat,
  mode: ImportMode,
  client: PrismaClient = defaultPrisma,
): Promise<ImportPreview> {
  const { parsed, errors } = adapter.parseRows(rows, format);

  const keys = parsed
    .map((r) => adapter.matchKey(r))
    .filter((k): k is string | number => k != null);
  const existingByKey = await adapter.fetchExisting(client, keys);

  const previewRows: ImportRowPreview[] = [];
  for (const row of parsed) {
    const key = adapter.matchKey(row);
    const existing = key != null ? existingByKey.get(key) ?? null : null;
    const { classification, changes } = adapter.diffAgainstExisting(row, existing);
    previewRows.push({
      line: (row as { line?: number }).line ?? 0,
      classification,
      matchKey: key,
      summary: adapter.summarize(row),
      changes,
    });
  }
  for (const error of errors) {
    previewRows.push({
      line: error.line,
      classification: "errored",
      matchKey: null,
      summary: `regel ${error.line}`,
      reason: error.reason,
    });
  }
  previewRows.sort((a, b) => a.line - b.line);

  const totals = {
    new: previewRows.filter((r) => r.classification === "new").length,
    updated: previewRows.filter((r) => r.classification === "updated").length,
    unchanged: previewRows.filter((r) => r.classification === "unchanged").length,
    skipped: previewRows.filter((r) => r.classification === "skipped").length,
    errored: previewRows.filter((r) => r.classification === "errored").length,
  };

  const preview: ImportPreview = { entity: adapter.entity, mode, sourceFormat: format, totals, rows: previewRows };

  if (mode === "replace") {
    const all = await adapter.fetchAllForReplace(client);
    preview.toDelete = all;
    const blockMap = await adapter.referentialChecks(client, all.map((r) => r.id));
    const blockers: ReplaceBlocker[] = all
      .filter((r) => (blockMap.get(r.id) ?? []).length > 0)
      .map((r) => ({ entityId: r.id, label: r.label, blockedBy: blockMap.get(r.id)! }));
    if (blockers.length > 0) preview.blockers = blockers;
  }

  return preview;
}

/** P3.1/P3.3 — update mode: upsert every classified row inside one
 * transaction. Replace mode: re-run the referential check (never trust
 * a client-held preview), then truncate + bulk-insert, one transaction,
 * with an `ImportAudit` row written inside it so a row only exists for
 * imports that actually committed. */
export async function applyImport<T>(
  adapter: EntityAdapter<T>,
  rows: Record<string, string>[],
  format: SourceFormat,
  mode: ImportMode,
  auditCtx: { userId: number; fileName: string },
  client: PrismaClient = defaultPrisma,
): Promise<ApplyResult | { blockers: ReplaceBlocker[] }> {
  const { parsed, errors } = adapter.parseRows(rows, format);

  if (mode === "replace") {
    const all = await adapter.fetchAllForReplace(client);
    const blockMap = await adapter.referentialChecks(client, all.map((r) => r.id));
    const blockers: ReplaceBlocker[] = all
      .filter((r) => (blockMap.get(r.id) ?? []).length > 0)
      .map((r) => ({ entityId: r.id, label: r.label, blockedBy: blockMap.get(r.id)! }));
    if (blockers.length > 0) return { blockers };

    let created = 0;
    const applyErrors = [...errors];
    await client.$transaction(async (tx) => {
      const txClient = tx as unknown as PrismaClient;
      await adapter.truncate(txClient);
      const ctx = await adapter.makeApplyContext(txClient);
      for (const row of parsed) {
        try {
          const outcome = await adapter.applyRow(txClient, row, ctx);
          if (outcome === "created") created++;
        } catch (e) {
          applyErrors.push({ line: (row as { line?: number }).line ?? 0, reason: (e as Error).message });
        }
      }
      await txClient.importAudit.create({
        data: {
          entity: adapter.entity,
          mode: "replace",
          userId: auditCtx.userId,
          fileName: auditCtx.fileName,
          rowCounts: { created, deleted: all.length, errors: applyErrors.length },
        },
      });
    });
    return { created, updated: 0, unchanged: 0, deleted: all.length, errors: applyErrors };
  }

  let created = 0;
  let updated = 0;
  let unchanged = 0;
  const applyErrors = [...errors];
  await client.$transaction(async (tx) => {
    const txClient = tx as unknown as PrismaClient;
    const ctx = await adapter.makeApplyContext(txClient);
    for (const row of parsed) {
      try {
        const outcome = await adapter.applyRow(txClient, row, ctx);
        if (outcome === "created") created++;
        else if (outcome === "updated") updated++;
        else unchanged++;
      } catch (e) {
        applyErrors.push({ line: (row as { line?: number }).line ?? 0, reason: (e as Error).message });
      }
    }
  });
  return { created, updated, unchanged, deleted: 0, errors: applyErrors };
}
