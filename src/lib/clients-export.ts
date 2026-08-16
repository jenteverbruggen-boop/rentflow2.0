import type { PrismaClient } from "@/generated/prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import type { ExportColumn } from "@/lib/export/xlsx-writer";

/** P2.2 — column contract from the design doc §1.4. No money column
 * exists on `Client` at all today, so there is nothing to gate on
 * `Kosten/Facturen` here — unlike materials/people. */
export const CLIENTS_EXPORT_COLUMNS: ExportColumn[] = [
  { key: "id", header: "id", type: "number" },
  { key: "name", header: "name", type: "string" },
  { key: "contactName", header: "contactName", type: "string" },
  { key: "email", header: "email", type: "string" },
  { key: "phone", header: "phone", type: "string" },
  { key: "address", header: "address", type: "string" },
  { key: "postalCode", header: "postalCode", type: "string" },
  { key: "city", header: "city", type: "string" },
  { key: "vatNumber", header: "vatNumber", type: "string" },
  { key: "notes", header: "notes", type: "string" },
];

export async function fetchClientsExportRows(
  client: PrismaClient = defaultPrisma,
): Promise<Record<string, unknown>[]> {
  const clients = await client.client.findMany({ orderBy: { name: "asc" } });
  return clients.map((c) => ({
    id: c.id,
    name: c.name,
    contactName: c.contactName,
    email: c.email,
    phone: c.phone,
    address: c.address,
    postalCode: c.postalCode,
    city: c.city,
    vatNumber: c.vatNumber,
    notes: c.notes,
  }));
}
