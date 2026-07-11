import { useQueryClient } from "@tanstack/react-query";
import type { Material } from "@/types";

export type EditableMaterialField =
  | "dayPrice"
  | "setupCost"
  | "category"
  | "code"
  | "notes"
  | "isBundle"
  | "bundlePriceOverride";

function coerce(field: EditableMaterialField, rawValue: string) {
  if (field === "dayPrice") return Number(rawValue);
  if (field === "isBundle") return rawValue === "true";
  if (field === "bundlePriceOverride" || field === "setupCost")
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
        [field]: coerce(field, rawValue),
      }),
    });
    if (!res.ok) throw new Error("Opslaan mislukt");
    const updated = await res.json();
    queryClient.setQueryData<Material[]>(["materials"], (old) =>
      old?.map((m) => (m.id === material.id ? { ...m, ...updated } : m)),
    );
    queryClient.invalidateQueries({ queryKey: ["materials"] });
  };
}
