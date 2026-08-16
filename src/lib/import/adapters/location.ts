import type { EntityAdapter, BlockingReference, ParseRowError } from "@/lib/import/pipeline-types";

export interface ParsedLocationRow {
  line: number;
  id: number | null;
  name: string;
  address: string | null;
  postalCode: string | null;
  city: string | null;
  phone: string | null;
  notes: string | null;
}

const FIELDS: (keyof ParsedLocationRow)[] = ["name", "address", "postalCode", "city", "phone", "notes"];

function parseRows(rows: Record<string, string>[]): { parsed: ParsedLocationRow[]; errors: ParseRowError[] } {
  const parsed: ParsedLocationRow[] = [];
  const errors: ParseRowError[] = [];
  rows.forEach((row, i) => {
    const line = i + 2;
    const name = (row.name ?? "").trim();
    if (!name) {
      errors.push({ line, reason: "geen naam" });
      return;
    }
    const rawId = (row.id ?? "").trim();
    const id = rawId ? Number(rawId) : null;
    if (rawId && !Number.isFinite(id)) {
      errors.push({ line, reason: "ongeldige id" });
      return;
    }
    parsed.push({
      line,
      id,
      name,
      address: (row.address ?? "").trim() || null,
      postalCode: (row.postalCode ?? "").trim() || null,
      city: (row.city ?? "").trim() || null,
      phone: (row.phone ?? "").trim() || null,
      notes: (row.notes ?? "").trim() || null,
    });
  });
  return { parsed, errors };
}

/** P3.2 — `id` is the match key (design doc §1.1). No money column on
 * `Location` at all, same reasoning as clients. */
export const locationAdapter: EntityAdapter<ParsedLocationRow> = {
  entity: "locations",
  acceptedFormats: ["rentflow"],
  requiredHeaders: ["name"],
  matchKeyLabel: "id",

  parseRows(rows) {
    return parseRows(rows);
  },

  matchKey(row) {
    return row.id;
  },

  summarize(row) {
    return row.name;
  },

  diffAgainstExisting(row, existing) {
    if (!existing) return { classification: "new" };
    const changes = FIELDS.filter((f) => f !== "line" && row[f] !== existing[f]).map((f) => ({ field: f, from: existing[f], to: row[f] }));
    return { classification: changes.length > 0 ? "updated" : "unchanged", changes: changes.length > 0 ? changes : undefined };
  },

  async applyRow(tx, row) {
    const data = {
      name: row.name,
      address: row.address,
      postalCode: row.postalCode,
      city: row.city,
      phone: row.phone,
      notes: row.notes,
    };
    const existing = row.id ? await tx.location.findUnique({ where: { id: row.id } }) : null;
    if (existing) {
      const changed = FIELDS.some((f) => f !== "line" && (existing as unknown as ParsedLocationRow)[f] !== row[f]);
      if (changed) await tx.location.update({ where: { id: existing.id }, data });
      return changed ? "updated" : "unchanged";
    }
    await tx.location.create({ data });
    return "created";
  },

  async makeApplyContext() {
    return {};
  },

  async fetchExisting(client, keys) {
    const locations = await client.location.findMany({ where: { id: { in: keys as number[] } } });
    const map = new Map<string | number, ParsedLocationRow>();
    for (const l of locations) map.set(l.id, { ...l, line: 0 } as unknown as ParsedLocationRow);
    return map;
  },

  async fetchAllForReplace(client) {
    const locations = await client.location.findMany({ select: { id: true, name: true } });
    return locations.map((l) => ({ id: l.id, label: l.name }));
  },

  async referentialChecks(client, ids) {
    const map = new Map<number, BlockingReference[]>();
    if (ids.length === 0) return map;
    // Project.locationId is SET NULL (design doc §7.4) — same
    // silent-orphan risk as Client, so the app-level check is the only
    // protection.
    const projects = await client.project.groupBy({ by: ["locationId"], where: { locationId: { in: ids } }, _count: true });
    for (const id of ids) {
      const count = projects.find((p) => p.locationId === id)?._count as number | undefined;
      if (count) map.set(id, [{ relation: "Project (projecten)", count }]);
    }
    return map;
  },

  async truncate(tx) {
    await tx.location.deleteMany();
  },
};
