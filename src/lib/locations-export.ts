import type { PrismaClient } from "@/generated/prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import type { ExportColumn } from "@/lib/export/xlsx-writer";

/** P2.2 — column contract from the design doc §1.5. No money column on
 * `Location` at all, same reasoning as clients. */
export const LOCATIONS_EXPORT_COLUMNS: ExportColumn[] = [
  { key: "id", header: "id", type: "number" },
  { key: "name", header: "name", type: "string" },
  { key: "address", header: "address", type: "string" },
  { key: "postalCode", header: "postalCode", type: "string" },
  { key: "city", header: "city", type: "string" },
  { key: "phone", header: "phone", type: "string" },
  { key: "notes", header: "notes", type: "string" },
];

export async function fetchLocationsExportRows(
  client: PrismaClient = defaultPrisma,
): Promise<Record<string, unknown>[]> {
  const locations = await client.location.findMany({ orderBy: { name: "asc" } });
  return locations.map((l) => ({
    id: l.id,
    name: l.name,
    address: l.address,
    postalCode: l.postalCode,
    city: l.city,
    phone: l.phone,
    notes: l.notes,
  }));
}
