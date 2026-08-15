import type { ParsedMaterialRow, MaterialParseError } from "@/lib/import/material-adapter";

function parseNumber(value: string | undefined): number | null {
  const raw = (value ?? "").trim();
  if (!raw) return null;
  const normalized = raw.replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function serialIdentifier(row: Record<string, string>): string | null {
  const candidates = [
    row["Manufacturer serial number (Serial number)"],
    row["Display name (Serial number)"],
    row["Internal reference (Serial number)"],
  ];
  return candidates.find((v) => v && v.trim().length > 0) ?? null;
}

function serialNotes(row: Record<string, string>): string | null {
  const parts: string[] = [];
  if ((row["Active (Serial number)"] ?? "").trim() === "0") parts.push("Inactive in source");
  const remark = (row["Remark (Serial number)"] ?? "").trim();
  if (remark) parts.push(remark);
  return parts.length > 0 ? parts.join(" | ") : null;
}

/**
 * M1.1 — groups the flattened equipment × serial-number rows by
 * Rentman's own `ID` column (not `Code` — see the design doc §2.2: a
 * serialized equipment item repeats one row per unit, sharing one ID
 * and one code; grouping by code would silently merge the true
 * `9998-902` collision away).
 */
export function parseRentmanRows(rows: Record<string, string>[]): {
  materials: ParsedMaterialRow[];
  errors: MaterialParseError[];
} {
  const groups = new Map<string, { firstLine: number; rows: Record<string, string>[] }>();
  rows.forEach((row, i) => {
    const id = (row.ID ?? "").trim();
    if (!id) return;
    if (!groups.has(id)) groups.set(id, { firstLine: i + 2, rows: [] });
    groups.get(id)!.rows.push(row);
  });

  const materials: ParsedMaterialRow[] = [];
  const errors: MaterialParseError[] = [];
  const claimedCodes = new Map<string, string>(); // code -> claiming external id

  // Stable order: lowest ID first, so a genuine code collision (§2.2)
  // always resolves in favour of the first-seen (lowest) ID.
  const sortedIds = [...groups.keys()].sort((a, b) => Number(a) - Number(b));

  for (const id of sortedIds) {
    const group = groups.get(id)!;
    const first = group.rows[0];
    const name = (first["Name (in database)"] ?? "").trim();
    const code = (first.Code ?? "").trim() || null;
    if (!name) {
      errors.push({ line: group.firstLine, reason: `ID ${id}: geen naam` });
      continue;
    }
    if (code) {
      const claimedBy = claimedCodes.get(code);
      if (claimedBy) {
        errors.push({
          line: group.firstLine,
          reason: `code ${code} is al gebruikt door ID ${claimedBy}`,
        });
        continue;
      }
      claimedCodes.set(code, id);
    }

    const folder = (first["Folder (Folder)"] ?? "").trim();
    const folderMatch = /^(\d{2,4})-(.+)$/.exec(folder);
    const categoryPrefix = folderMatch ? folderMatch[1] : null;
    const categoryName = folderMatch ? folderMatch[2] : null;

    const type = (first["Type of equipment"] ?? "").trim();
    // §2.4 — Virtual combination is a real recipe-based bundle (empty,
    // since Combination structure is never populated in either export);
    // Physical combination is an ordinary asset that happens to
    // permanently bundle sub-parts, imported like any other material.
    const isBundle = type === "Virtual combination";

    const archived =
      (first.Archived ?? "").trim() === "1" || (first["Display in planner"] ?? "").trim() === "0";

    const stockMethod = (first["Stock calculation method"] ?? "").trim();
    let stockItems: { identifier: string | null; notes: string | null }[] = [];
    if (!isBundle) {
      if (stockMethod === "Serialized") {
        stockItems = group.rows.map((r) => ({ identifier: serialIdentifier(r), notes: serialNotes(r) }));
      } else {
        const qty = Math.max(0, Math.round(parseNumber(first["Current quantity"]) ?? 0));
        stockItems = Array.from({ length: qty }, () => ({ identifier: null, notes: null }));
      }
    }

    materials.push({
      line: group.firstLine,
      externalId: id,
      code,
      name,
      categoryName,
      categoryPrefix,
      dayPrice: parseNumber(first["Rental-/Sales price"]) ?? 0,
      costPrice: parseNumber(first["Margin price"]),
      listPrice: parseNumber(first["List price"]),
      isBundle,
      archived,
      notes: (first["Internal remark"] ?? "").trim() || null,
      stockItems,
    });
  }

  return { materials, errors };
}
