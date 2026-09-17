import type { EntityAdapter } from "@/lib/import/pipeline-types";
import { parseClientRows, CLIENT_FIELDS, type ParsedClientRow } from "@/lib/import/client-parse";
import { clientReferentialChecks } from "@/lib/import/client-referential";
import {
  resolveClientMatchKey,
  resolveClientMatchField,
  indexExistingClientsByMatchKey,
  findExistingClientMatch,
} from "@/lib/import/client-match";

export type { ParsedClientRow } from "@/lib/import/client-parse";

/** P3.2 — `id` is the match key when present (design doc §1.1). B4
 * (round 3 PO feedback) adds a fallback chain — normalized VAT number →
 * normalized email → normalized name — for rows with no `id` at all,
 * i.e. every row from a real, foreign export. See client-match.ts for
 * the shared logic `matchKey`/`fetchExisting`/`applyRow` all use so
 * they can't drift out of sync, and client-parse.ts for how a
 * `rentman-clients` row's fields are read. No money column on `Client`
 * at all — the diff/apply here is a plain field-by-field upsert, no
 * rate/discount complications like people/materials. */
export const clientAdapter: EntityAdapter<ParsedClientRow> = {
  entity: "clients",
  acceptedFormats: ["rentflow", "rentman-clients"],
  requiredHeaders: ["name"],
  matchKeyLabel: "id",

  parseRows(rows, format) {
    return parseClientRows(rows, format);
  },

  matchKey(row) {
    return resolveClientMatchKey(row);
  },

  summarize(row) {
    return row.name;
  },

  diffAgainstExisting(row, existing) {
    if (!existing) return { classification: "new" };
    const changes = CLIENT_FIELDS.filter((f) => f !== "line" && row[f] !== existing[f]).map((f) => ({ field: f, from: existing[f], to: row[f] }));
    return {
      classification: changes.length > 0 ? "updated" : "unchanged",
      changes: changes.length > 0 ? changes : undefined,
      matchField: resolveClientMatchField(row),
    };
  },

  async applyRow(tx, row, ctx) {
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
    const existingClients = ctx.existingClients as ParsedClientRow[];
    const existing = findExistingClientMatch(row, existingClients);
    if (existing) {
      const changed = CLIENT_FIELDS.some((f) => f !== "line" && existing[f] !== row[f]);
      if (changed) {
        await tx.client.update({ where: { id: existing.id! }, data });
        Object.assign(existing, row, { id: existing.id, line: existing.line });
      }
      return changed ? "updated" : "unchanged";
    }
    const created = await tx.client.create({ data });
    // Keep the in-memory list current within this same import batch, so
    // two rows in one file that share a VAT/email/name (e.g. a
    // duplicate line) match each other instead of both being created.
    existingClients.push({ ...created, line: 0 } as unknown as ParsedClientRow);
    return "created";
  },

  async makeApplyContext(tx) {
    const clients = await tx.client.findMany();
    return { existingClients: clients.map((c) => ({ ...c, line: 0 })) };
  },

  async fetchExisting(client, keys) {
    const clients = await client.client.findMany();
    const rows: ParsedClientRow[] = clients.map((c) => ({ ...c, line: 0 } as unknown as ParsedClientRow));
    const indexed = indexExistingClientsByMatchKey(rows);
    const map = new Map<string | number, ParsedClientRow>();
    for (const key of keys) {
      const match = indexed.get(key);
      if (match) map.set(key, match);
    }
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
