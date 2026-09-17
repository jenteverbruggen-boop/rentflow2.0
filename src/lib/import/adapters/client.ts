import type { EntityAdapter } from "@/lib/import/pipeline-types";
import { parseClientRows, CLIENT_FIELDS, type ParsedClientRow } from "@/lib/import/client-parse";
import { clientReferentialChecks } from "@/lib/import/client-referential";

export type { ParsedClientRow } from "@/lib/import/client-parse";

/** P3.2 — `id` is the match key (design doc §1.1). B4 (round 3 PO
 * feedback) adds `rentman-clients` format support via client-parse.ts,
 * so a real customer export's Dutch headers are read correctly — the
 * fallback match key for a row with no `id` at all is a separate,
 * follow-up concern. No money column on `Client` at all — the
 * diff/apply here is a plain field-by-field upsert, no rate/discount
 * complications like people/materials. */
export const clientAdapter: EntityAdapter<ParsedClientRow> = {
  entity: "clients",
  acceptedFormats: ["rentflow", "rentman-clients"],
  requiredHeaders: ["name"],
  matchKeyLabel: "id",

  parseRows(rows, format) {
    return parseClientRows(rows, format);
  },

  matchKey(row) {
    return row.id;
  },

  summarize(row) {
    return row.name;
  },

  diffAgainstExisting(row, existing) {
    if (!existing) return { classification: "new" };
    const changes = CLIENT_FIELDS.filter((f) => f !== "line" && row[f] !== existing[f]).map((f) => ({ field: f, from: existing[f], to: row[f] }));
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
      const changed = CLIENT_FIELDS.some((f) => f !== "line" && (existing as unknown as ParsedClientRow)[f] !== row[f]);
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
    return clientReferentialChecks(client, ids);
  },

  async truncate(tx) {
    await tx.client.deleteMany();
  },
};
