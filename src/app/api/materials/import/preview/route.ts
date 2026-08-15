import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModule, forbidden, badRequest, serverError } from "@/lib/api-auth";
import { parseImportFile } from "@/lib/import/parse-file";
import { detectFormat } from "@/lib/import/format-detection";
import { parseMaterialRows } from "@/lib/import/material-adapter";
import { buildMaterialPreview, type ExistingMaterial } from "@/lib/import/material-preview";
import { toNumberOrNull } from "@/lib/serialize";

// M1.2 — never writes. Module Materialen:wijzigen, same as apply (M1.4)
// — stated explicitly since N2.5's guard enumeration checks every
// handler declares one, but doesn't check *which* module/level, so the
// preview/apply pairing being identical is a design choice worth
// recording here, not just inferable from the code.
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

    const codes = materials.map((m) => m.code).filter((c): c is string => !!c);
    const existing = await prisma.material.findMany({ where: { code: { in: codes } } });
    const existingByCode = new Map<string, ExistingMaterial>(
      existing.map((m) => [
        m.code!,
        {
          code: m.code!,
          name: m.name,
          dayPrice: toNumberOrNull(m.dayPrice) ?? 0,
          costPrice: toNumberOrNull(m.costPrice) ?? null,
          listPrice: toNumberOrNull(m.listPrice) ?? null,
          isBundle: m.isBundle,
          archived: m.archived,
          notes: m.notes,
        },
      ]),
    );

    const preview = buildMaterialPreview(materials, errors, existingByCode, format);
    return NextResponse.json(preview);
  } catch (err) {
    return serverError((err as Error).message);
  }
}
