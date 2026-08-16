import type { PrismaClient } from "@/generated/prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { toNumber } from "@/lib/serialize";
import { moneyVisible } from "@/lib/redact";
import type { ResolvedAccess } from "@/lib/api-auth";
import type { ExportColumn } from "@/lib/export/xlsx-writer";

/** P2.2 — column contract from the design doc §1.3. `role` is gone
 * (L4.2 dropped the column); `functions` mirrors the round-trip shape as
 * a comma-separated list of function names, matching the design doc's
 * own note that the export should carry function names, not ids, for a
 * human-readable re-import. */
export function peopleExportColumns(access: ResolvedAccess): ExportColumn[] {
  const base: ExportColumn[] = [
    { key: "id", header: "id", type: "number" },
    { key: "name", header: "name", type: "string" },
    { key: "email", header: "email", type: "string" },
    { key: "phone", header: "phone", type: "string" },
    { key: "address", header: "address", type: "string" },
    { key: "postalCode", header: "postalCode", type: "string" },
    { key: "city", header: "city", type: "string" },
    { key: "country", header: "country", type: "string" },
    { key: "functions", header: "functions", type: "string" },
  ];
  if (!moneyVisible(access)) return base;
  return [...base, { key: "dayPrice", header: "dayPrice", type: "number" }];
}

export async function fetchPeopleExportRows(
  client: PrismaClient = defaultPrisma,
): Promise<Record<string, unknown>[]> {
  const people = await client.person.findMany({
    orderBy: { name: "asc" },
    include: { functions: { include: { function: true } } },
  });

  return people.map((p) => ({
    id: p.id,
    name: p.name,
    email: p.email,
    phone: p.phone,
    address: p.address,
    postalCode: p.postalCode,
    city: p.city,
    country: p.country,
    functions: p.functions.map((f) => f.function.name).join(", "),
    dayPrice: toNumber(p.dayPrice),
  }));
}
