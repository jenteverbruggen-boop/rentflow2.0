import type { EntityAdapter, BlockingReference, ParseRowError } from "@/lib/import/pipeline-types";

export interface ParsedClientRow {
  line: number;
  id: number | null;
  name: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  postalCode: string | null;
  city: string | null;
  vatNumber: string | null;
  notes: string | null;
}

const FIELDS: (keyof ParsedClientRow)[] = ["name", "contactName", "email", "phone", "address", "postalCode", "city", "vatNumber", "notes"];

function parseRows(rows: Record<string, string>[]): { parsed: ParsedClientRow[]; errors: ParseRowError[] } {
  const parsed: ParsedClientRow[] = [];
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
      contactName: (row.contactName ?? "").trim() || null,
      email: (row.email ?? "").trim() || null,
      phone: (row.phone ?? "").trim() || null,
      address: (row.address ?? "").trim() || null,
      postalCode: (row.postalCode ?? "").trim() || null,
      city: (row.city ?? "").trim() || null,
      vatNumber: (row.vatNumber ?? "").trim() || null,
      notes: (row.notes ?? "").trim() || null,
    });
  });
  return { parsed, errors };
}

/** P3.2 — `id` is the match key (design doc §1.1). No money column on
 * `Client` at all — the diff/apply here is a plain field-by-field
 * upsert, no rate/discount complications like people/materials. */
export const clientAdapter: EntityAdapter<ParsedClientRow> = {
  entity: "clients",
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
      contactName: row.contactName,
      email: row.email,
      phone: row.phone,
      address: row.address,
      postalCode: row.postalCode,
      city: row.city,
      vatNumber: row.vatNumber,
      notes: row.notes,
    };
    const existing = row.id ? await tx.client.findUnique({ where: { id: row.id } }) : null;
    if (existing) {
      const changed = FIELDS.some((f) => f !== "line" && (existing as unknown as ParsedClientRow)[f] !== row[f]);
      if (changed) await tx.client.update({ where: { id: existing.id }, data });
      return changed ? "updated" : "unchanged";
    }
    await tx.client.create({ data });
    return "created";
  },

  async makeApplyContext() {
    return {};
  },

  async fetchExisting(client, keys) {
    const clients = await client.client.findMany({ where: { id: { in: keys as number[] } } });
    const map = new Map<string | number, ParsedClientRow>();
    for (const c of clients) map.set(c.id, { ...c, line: 0 } as unknown as ParsedClientRow);
    return map;
  },

  async fetchAllForReplace(client) {
    const clients = await client.client.findMany({ select: { id: true, name: true } });
    return clients.map((c) => ({ id: c.id, label: c.name }));
  },

  async referentialChecks(client, ids) {
    const map = new Map<number, BlockingReference[]>();
    if (ids.length === 0) return map;
    // Project.clientId is SET NULL (design doc §7.4) — the DB will not
    // refuse this delete, so the app-level check is the only
    // protection, not a backstop to a DB error.
    const projects = await client.project.groupBy({ by: ["clientId"], where: { clientId: { in: ids } }, _count: true });
    const invoices = await client.invoice.groupBy({ by: ["clientId"], where: { clientId: { in: ids } }, _count: true });
    for (const id of ids) {
      const blocks: BlockingReference[] = [];
      const projectCount = projects.find((p) => p.clientId === id)?._count as number | undefined;
      if (projectCount) blocks.push({ relation: "Project (projecten)", count: projectCount });
      const invoiceCount = invoices.find((i) => i.clientId === id)?._count as number | undefined;
      if (invoiceCount) blocks.push({ relation: "Invoice (facturen)", count: invoiceCount });
      if (blocks.length > 0) map.set(id, blocks);
    }
    return map;
  },

  async truncate(tx) {
    await tx.client.deleteMany();
  },
};
