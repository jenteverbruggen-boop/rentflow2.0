import { NextRequest, NextResponse } from "next/server";
import { requireModule, forbidden, badRequest, notFound, serverError } from "@/lib/api-auth";
import { parseImportFile } from "@/lib/import/parse-file";
import { detectEntityFormat } from "@/lib/import/format-detection";
import { applyImport } from "@/lib/import/pipeline";
import { resolveImportEntity, getImportAdapter, IMPORT_ENTITY_MODULE } from "@/lib/import/entity-registry";
import { rejectedMoneyImportHeader } from "@/lib/import/money-guard";
import type { ImportMode } from "@/lib/import/pipeline-types";

type Params = { params: Promise<{ entity: string }> };

const MAX_SIZE = 20 * 1024 * 1024;

// Dutch labels the user must type verbatim before a replace is allowed
// to run — never a bare OK button (Q49b §7.2). These are the same
// literal strings used as ModuleKey values, since they already read as
// the entity's own Dutch name.
const ENTITY_LABELS: Record<string, string> = {
  materials: "materialen",
  people: "personen",
  clients: "klanten",
  locations: "locaties",
};

/**
 * P3.1/P3.3 — the generalised apply route. `mode: "replace"` additionally
 * requires `typedConfirmation` to exactly match the entity's Dutch label
 * and re-runs the referential check server-side (never trusts a
 * client-held preview) before truncating anything.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const { entity: entityParam } = await params;
  const entity = resolveImportEntity(entityParam);
  if (!entity) return notFound();
  const moduleKey = IMPORT_ENTITY_MODULE[entity];

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const modeRaw = formData.get("mode");
    const mode: ImportMode = modeRaw === "replace" ? "replace" : "update";

    const access = await requireModule(moduleKey, mode === "replace" ? "verwijderen" : "wijzigen").catch(() => null);
    if (!access) return forbidden();
    if (access.scope === "own") return forbidden();

    if (!file) return badRequest("Geen bestand ontvangen");
    if (file.size > MAX_SIZE) return badRequest("Bestand is te groot (max. 20 MB)");

    if (mode === "replace") {
      const typed = (formData.get("typedConfirmation") as string | null)?.trim();
      if (typed !== ENTITY_LABELS[entity]) {
        return badRequest(`Typ "${ENTITY_LABELS[entity]}" om te bevestigen`);
      }
    }

    const adapter = getImportAdapter(entity);
    const buffer = Buffer.from(await file.arrayBuffer());
    const { headers, rows } = await parseImportFile(buffer, file.name);
    const format = detectEntityFormat(headers, adapter.acceptedFormats, adapter.requiredHeaders);
    if (format === "unknown") {
      return badRequest(
        `Onherkend bestandsformaat — verwacht kolommen: ${adapter.requiredHeaders.join(", ")}`,
      );
    }

    // Mirrors the single-record write gate (findRejectedMoneyWrite):
    // refuse the whole import rather than silently importing every
    // other field and dropping just the price, if the caller lacks
    // Kosten/Facturen: wijzigen and the file carries a money column.
    if (rejectedMoneyImportHeader(entity, headers, access)) return forbidden();

    const result = await applyImport(adapter, rows, format, mode, { userId: access.id, fileName: file.name });
    if ("blockers" in result) {
      return NextResponse.json(
        { error: "Verwijderen geblokkeerd door bestaande koppelingen", blockers: result.blockers },
        { status: 409 },
      );
    }
    return NextResponse.json(result);
  } catch (err) {
    return serverError((err as Error).message);
  }
}
