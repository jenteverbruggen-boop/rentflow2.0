import { useQueryClient } from "@tanstack/react-query";
import type { Material } from "@/types";

export type EditableMaterialField =
  | "dayPrice"
  | "setupCost"
  | "category"
  | "categoryId"
  | "code"
  | "notes"
  | "isBundle"
  | "bundlePriceOverride"
  | "costPrice"
  | "listPrice"
  | "revenueBefore"
  | "subhireUnitCost"
  | "subhireCostBasis"
  | "subhireOnly"
  | "defaultSupplierId";

const NULLABLE_NUMBER_FIELDS = new Set<EditableMaterialField>([
  "bundlePriceOverride",
  "setupCost",
  "costPrice",
  "listPrice",
  "revenueBefore",
  "categoryId",
  "subhireUnitCost",
  "defaultSupplierId",
]);

function coerce(field: EditableMaterialField, rawValue: string) {
  if (field === "dayPrice") return Number(rawValue);
  if (field === "isBundle" || field === "subhireOnly") return rawValue === "true";
  if (NULLABLE_NUMBER_FIELDS.has(field))
    return rawValue.trim() === "" ? null : Number(rawValue);
  return rawValue || null;
}

export function useMaterialUpdate(material: Material | null) {
  const queryClient = useQueryClient();

  return async function saveField(
    field: EditableMaterialField,
    rawValue: string,
  ) {
    if (!material) return;
    const res = await fetch(`/api/materials/${material.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: material.name,
        category: material.category,
        categoryId: material.categoryId,
        code: material.code,
        notes: material.notes,
        dayPrice: material.dayPrice,
        setupCost: material.setupCost,
        isBundle: material.isBundle,
        bundlePriceOverride: material.bundlePriceOverride,
        costPrice: material.costPrice,
        listPrice: material.listPrice,
        revenueBefore: material.revenueBefore,
        // The PUT replaces the subhire columns it is sent (and nulls an unsent
        // unit cost), so every save echoes the current values back.
        subhireUnitCost: material.subhireUnitCost,
        defaultSupplierId: material.defaultSupplierId,
        subhireCostBasis: material.subhireCostBasis,
        subhireOnly: material.subhireOnly,
        [field]: coerce(field, rawValue),
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error(data?.error ?? "Opslaan mislukt");
    }
    const updated = await res.json();
    queryClient.setQueryData<Material[]>(["materials"], (old) =>
      old?.map((m) => (m.id === material.id ? { ...m, ...updated } : m)),
    );
    queryClient.invalidateQueries({ queryKey: ["materials"] });
  };
}
