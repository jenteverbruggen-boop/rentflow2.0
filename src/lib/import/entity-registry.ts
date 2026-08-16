import type { ModuleKey } from "@/types";
import type { EntityAdapter, ImportEntity } from "@/lib/import/pipeline-types";
import { materialAdapter } from "@/lib/import/adapters/material";
import { personAdapter } from "@/lib/import/adapters/person";
import { clientAdapter } from "@/lib/import/adapters/client";
import { locationAdapter } from "@/lib/import/adapters/location";

/**
 * P3.1 — the generic `/api/import/[entity]/*` routes resolve their
 * per-entity behaviour from here. Invoices are deliberately never
 * registered (design doc §1.6) — an unknown/unregistered entity param
 * is a `404`, not a silently-permissive fallback.
 */
export const IMPORT_ENTITY_MODULE: Record<ImportEntity, ModuleKey> = {
  materials: "materialen",
  people: "personen",
  clients: "klanten",
  locations: "locaties",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ADAPTERS: Record<ImportEntity, EntityAdapter<any>> = {
  materials: materialAdapter,
  people: personAdapter,
  clients: clientAdapter,
  locations: locationAdapter,
};

export function resolveImportEntity(entity: string): ImportEntity | null {
  return entity in ADAPTERS ? (entity as ImportEntity) : null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getImportAdapter(entity: ImportEntity): EntityAdapter<any> {
  return ADAPTERS[entity];
}
