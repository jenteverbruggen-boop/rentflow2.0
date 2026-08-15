import { NextRequest, NextResponse } from "next/server";
import { requireModule, forbidden, badRequest, serverError } from "@/lib/api-auth";
import { parseImportFile } from "@/lib/import/parse-file";
import { detectFormat } from "@/lib/import/format-detection";
import { parseMaterialRows } from "@/lib/import/material-adapter";
import { applyMaterialImport } from "@/lib/import/apply-material-import";

/**
 * M1.4 — applies an import. Same module/level guard as the preview
 * route (M1.2) since both write to the exact same catalogue surface;
 * the only difference is this one actually persists. There is
 * deliberately no "apply straight from upload" shortcut anywhere else —
 * the UI (M1.5) always routes through /preview first.
 */
export async function POST(req: NextRequest) {
  const access = await requireModule("materialen", "wijzigen").catch(() => null);
  if (!access) return forbidden();
  if (access.scope === "own") return forbidden();

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return badRequest("Geen bestand ontvangen");

    const buffer = Buffer.from(await file.arrayBuffer());
    const { headers, rows } = await parseImportFile(buffer, file.name);
    const format = detectFormat(headers);
    if (format === "unknown") {
      return badRequest(
        "Onherkend bestandsformaat — verwacht een Rentman-materiaalexport of een RentFlow-export",
      );
    }

    const { materials, errors } = parseMaterialRows(rows, format);
    const result = await applyMaterialImport(materials, errors);
    return NextResponse.json(result);
  } catch (err) {
    return serverError((err as Error).message);
  }
}
