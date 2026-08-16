import type { EntityAdapter, BlockingReference, ParseRowError } from "@/lib/import/pipeline-types";
import { diffFunctionIds } from "@/lib/person-functions-diff";

export interface ParsedPersonRow {
  line: number;
  id: number | null;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  postalCode: string | null;
  city: string | null;
  country: string | null;
  functions: string[];
  dayPrice: number;
}

interface ExistingPerson {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  postalCode: string | null;
  city: string | null;
  country: string | null;
  functions: string[];
  dayPrice: number;
}

const FIELDS: (keyof ExistingPerson)[] = ["name", "email", "phone", "address", "postalCode", "city", "country", "dayPrice"];

function parseRows(rows: Record<string, string>[]): { parsed: ParsedPersonRow[]; errors: ParseRowError[] } {
  const parsed: ParsedPersonRow[] = [];
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
      email: (row.email ?? "").trim() || null,
      phone: (row.phone ?? "").trim() || null,
      address: (row.address ?? "").trim() || null,
      postalCode: (row.postalCode ?? "").trim() || null,
      city: (row.city ?? "").trim() || null,
      country: (row.country ?? "").trim() || null,
      functions: (row.functions ?? "").split(",").map((f) => f.trim()).filter(Boolean),
      dayPrice: Number((row.dayPrice ?? "0").replace(",", ".")) || 0,
    });
  });
  return { parsed, errors };
}

/** P3.2 — `id` is the match key (design doc §1.1), not `code` like
 * materials: re-importing RentFlow's own export (P2.2) round-trips by
 * id. A row with no `id` at all is always `new`. */
export const personAdapter: EntityAdapter<ParsedPersonRow> = {
  entity: "people",
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
    const changes = FIELDS.filter((f) => row[f] !== existing[f]).map((f) => ({ field: f, from: existing[f], to: row[f] }));
    const functionsChanged = row.functions.slice().sort().join(",") !== existing.functions.slice().sort().join(",");
    if (functionsChanged) changes.push({ field: "functions", from: existing.functions.join(", "), to: row.functions.join(", ") });
    return { classification: changes.length > 0 ? "updated" : "unchanged", changes: changes.length > 0 ? changes : undefined };
  },

  async applyRow(tx, row) {
    const data = {
      name: row.name,
      email: row.email,
      phone: row.phone,
      address: row.address,
      postalCode: row.postalCode,
      city: row.city,
      country: row.country,
      dayPrice: row.dayPrice,
    };

    const existing = row.id ? await tx.person.findUnique({ where: { id: row.id }, include: { functions: true } }) : null;
    const allFunctions = await tx.function.findMany({ select: { id: true, name: true } });
    const byName = new Map(allFunctions.map((f) => [f.name, f.id]));
    const nextFunctionIds = row.functions.map((n) => byName.get(n)).filter((id): id is number => id != null);

    if (existing) {
      const changed =
        existing.name !== data.name ||
        existing.email !== data.email ||
        existing.phone !== data.phone ||
        existing.address !== data.address ||
        existing.postalCode !== data.postalCode ||
        existing.city !== data.city ||
        existing.country !== data.country ||
        Number(existing.dayPrice) !== data.dayPrice;
      const { toAdd, toRemove } = diffFunctionIds(existing.functions.map((f) => f.functionId), nextFunctionIds);

      if (changed) await tx.person.update({ where: { id: existing.id }, data });
      if (toRemove.length > 0) {
        await tx.personFunction.deleteMany({ where: { personId: existing.id, functionId: { in: toRemove } } });
      }
      if (toAdd.length > 0) {
        await tx.personFunction.createMany({
          data: toAdd.map((functionId) => ({ personId: existing.id, functionId })),
        });
      }
      return changed || toAdd.length > 0 || toRemove.length > 0 ? "updated" : "unchanged";
    }

    const created = await tx.person.create({ data });
    if (nextFunctionIds.length > 0) {
      await tx.personFunction.createMany({ data: nextFunctionIds.map((functionId) => ({ personId: created.id, functionId })) });
    }
    return "created";
  },

  async makeApplyContext() {
    return {};
  },

  async fetchExisting(client, keys) {
    const people = await client.person.findMany({
      where: { id: { in: keys as number[] } },
      include: { functions: { include: { function: true } } },
    });
    const map = new Map<string | number, ParsedPersonRow>();
    for (const p of people) {
      const existing: ExistingPerson = {
        id: p.id,
        name: p.name,
        email: p.email,
        phone: p.phone,
        address: p.address,
        postalCode: p.postalCode,
        city: p.city,
        country: p.country,
        functions: p.functions.map((f) => f.function.name),
        dayPrice: Number(p.dayPrice),
      };
      map.set(p.id, existing as unknown as ParsedPersonRow);
    }
    return map;
  },

  async fetchAllForReplace(client) {
    const people = await client.person.findMany({ select: { id: true, name: true } });
    return people.map((p) => ({ id: p.id, label: p.name }));
  },

  async referentialChecks(client, ids) {
    const map = new Map<number, BlockingReference[]>();
    if (ids.length === 0) return map;
    const bookings = await client.periodPerson.groupBy({ by: ["personId"], where: { personId: { in: ids } }, _count: true });
    const priceOverrides = await client.projectPersonPrice.groupBy({ by: ["personId"], where: { personId: { in: ids } }, _count: true });
    const linkedUsers = await client.user.groupBy({ by: ["personId"], where: { personId: { in: ids } }, _count: true });

    for (const id of ids) {
      const blocks: BlockingReference[] = [];
      const bookingCount = bookings.find((b) => b.personId === id)?._count as number | undefined;
      if (bookingCount) blocks.push({ relation: "PeriodPerson (boekingen)", count: bookingCount });
      const priceCount = priceOverrides.find((p) => p.personId === id)?._count as number | undefined;
      if (priceCount) blocks.push({ relation: "ProjectPersonPrice (projectprijzen)", count: priceCount });
      // User.personId is SET NULL, not blocking (design doc §7.4) — the
      // linked-account count is informational only, surfaced as its own
      // (non-blocking) label rather than a ReplaceBlocker.
      const userCount = linkedUsers.find((u) => u.personId === id)?._count as number | undefined;
      if (userCount) blocks.push({ relation: "Gekoppelde gebruikersaccounts (worden ontkoppeld, niet geblokkeerd)", count: 0 });
      if (blocks.some((b) => b.count > 0)) map.set(id, blocks.filter((b) => b.count > 0));
    }
    return map;
  },

  async truncate(tx) {
    await tx.person.deleteMany();
  },
};
