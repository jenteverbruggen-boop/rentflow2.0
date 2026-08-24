import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Material, StockItem } from "@/types";

async function fetchStockItems(materialId: number): Promise<StockItem[]> {
  const res = await fetch(`/api/materials/${materialId}/stock-items`);
  if (!res.ok) throw new Error("Ophalen mislukt");
  return res.json();
}

/** All data-fetching and mutation state for StockItemsSheet, extracted
 * so the sheet component itself stays under the 150-line limit — pure
 * move, no behaviour change. Dialog-open booleans stay in the component
 * (pure UI state); call-site `onSuccess` callbacks close them. */
export function useStockItemsSheet(
  material: Material | null,
  onMaterialDeleted: () => void,
  onOpenChange: (open: boolean) => void,
) {
  const queryClient = useQueryClient();
  const [editingStock, setEditingStock] = useState<StockItem | null>(null);
  const [deleteError, setDeleteError] = useState("");

  const stockKey = ["material", material?.id, "stock-items"] as const;

  const { data: stockItems = [] } = useQuery({
    queryKey: stockKey,
    queryFn: () => fetchStockItems(material!.id),
    enabled: !!material,
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["materials"] });
    queryClient.invalidateQueries({ queryKey: stockKey });
  };

  const upsertStock = useMutation({
    mutationFn: async (values: { identifier?: string; notes?: string }) => {
      const url = editingStock
        ? `/api/stock-items/${editingStock.id}`
        : `/api/materials/${material!.id}/stock-items`;
      const res = await fetch(url, {
        method: editingStock ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) throw new Error("Opslaan mislukt");
    },
    onSuccess: () => { setEditingStock(null); invalidateAll(); },
  });

  const deleteStock = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/stock-items/${id}`, { method: "DELETE" });
      if (res.status === 409) throw new Error("Unit is geboekt en kan niet verwijderd worden.");
      if (!res.ok) throw new Error("Verwijderen mislukt");
    },
    onSuccess: () => { setDeleteError(""); invalidateAll(); },
    onError: (err) => setDeleteError((err as Error).message),
  });

  const updateMaterial = useMutation({
    mutationFn: async (values: Omit<Material, "id">) => {
      const res = await fetch(`/api/materials/${material!.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) throw new Error("Opslaan mislukt");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["materials"] }),
  });

  const deleteMaterial = useMutation({
    mutationFn: async () => {
      await fetch(`/api/materials/${material!.id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      onOpenChange(false);
      onMaterialDeleted();
      queryClient.invalidateQueries({ queryKey: ["materials"] });
    },
  });

  return { stockItems, editingStock, setEditingStock, deleteError, upsertStock, deleteStock, updateMaterial, deleteMaterial };
}
