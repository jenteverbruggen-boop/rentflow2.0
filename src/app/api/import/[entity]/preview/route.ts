import { NextRequest, NextResponse } from "next/server";
import { requireModule, forbidden, badRequest, notFound, serverError } from "@/lib/api-auth";
import { parseImportFile } from "@/lib/import/parse-file";
import { detectEntityFormat } from "@/lib/import/format-detection";
import { buildImportPreview } from "@/lib/import/pipeline";
import { resolveImportEntity, getImportAdapter, IMPORT_ENTITY_MODULE } from "@/lib/import/entity-registry";
import type { ImportMode } from "@/lib/import/pipeline-types";

type Params = { params: Promise<{ entity: string }> };

const MAX_SIZE = 20 * 1024 * 1024;

/**
 * P3.1/P3.3 — the generalised preview route (design doc §9.2), covering
 * all four adapters through one handler. Never writes. `mode: "replace"`
 * requires `verwijderen` on the entity's own module (Q49b's
 * update→write / replace→delete mapping onto the existing four-level
 * matrix); `mode: "update"` requires `wijzigen`, same as M1's own
 * dedicated materials routes.
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

    const adapter = getImportAdapter(entity);
    const buffer = Buffer.from(await file.arrayBuffer());
    const { headers, rows } = await parseImportFile(buffer, file.name);
    const format = detectEntityFormat(headers, adapter.acceptedFormats, adapter.requiredHeaders);
    if (format === "unknown") {
      return badRequest(
        `Onherkend bestandsformaat — verwacht kolommen: ${adapter.requiredHeaders.join(", ")}`,
      );
    }

    const preview = await buildImportPreview(adapter, rows, format, mode);
    return NextResponse.json(preview);
  } catch (err) {
    return serverError((err as Error).message);
  }
}
