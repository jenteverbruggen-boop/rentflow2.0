"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { MaterialForm } from "@/components/material-form";
import { MaterialDetailPane } from "@/components/material-detail-pane";
import { MaterialsTreePane, type MaterialSort } from "@/components/materials-tree-pane";
import { StockItemsSheet } from "@/components/stock-items-sheet";
import { useMaterials } from "@/hooks/use-materials";
import type { Material } from "@/types";

export default function MaterialsPage() {
  const { query, create } = useMaterials();
  const materials = query.data ?? [];

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState<MaterialSort>("name-asc");
  const [selectedMaterialId, setSelectedMaterialId] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const categories = useMemo(() => {
    const set = new Set<string>();
    materials.forEach((m) => m.category && set.add(m.category));
    return Array.from(set).sort();
  }, [materials]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const matches = materials.filter((m) => {
      if (category !== "all" && m.category !== category) return false;
      if (!q) return true;
      return m.name.toLowerCase().includes(q) || (m.category ?? "").toLowerCase().includes(q);
    });

    if (sort === "stock-desc") return matches.sort((a, b) => (b.totalStock ?? 0) - (a.totalStock ?? 0));
    if (sort === "name-desc") return matches.sort((a, b) => b.name.localeCompare(a.name));
    return matches.sort((a, b) => a.name.localeCompare(b.name));
  }, [materials, search, category, sort]);

  const materialsByCategory = useMemo(() => {
    const grouped = new Map<string, Material[]>();
    for (const material of filtered) {
      const key = material.category ?? "Overig";
      grouped.set(key, [...(grouped.get(key) ?? []), material]);
    }
    return Array.from(grouped.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  const selectedMaterial = useMemo(
    () => materials.find((m) => m.id === selectedMaterialId) ?? null,
    [materials, selectedMaterialId],
  );

  useEffect(() => {
    if (selectedMaterialId && materials.some((m) => m.id === selectedMaterialId)) return;
    setSelectedMaterialId(filtered[0]?.id ?? null);
  }, [selectedMaterialId, materials, filtered]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Materialen</h2>
        <Button onClick={() => setFormOpen(true)}>+ Nieuw materiaal</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[380px_minmax(0,1fr)] gap-4">
        <MaterialsTreePane
          materialsByCategory={materialsByCategory}
          categories={categories}
          search={search}
          onSearchChange={setSearch}
          category={category}
          onCategoryChange={setCategory}
          sort={sort}
          onSortChange={setSort}
          selectedMaterialId={selectedMaterialId}
          onSelectMaterial={setSelectedMaterialId}
        />

        <MaterialDetailPane
          material={selectedMaterial}
          onManageUnits={() => selectedMaterial && setSheetOpen(true)}
        />
      </div>

      <MaterialForm
        open={formOpen}
        onOpenChange={setFormOpen}
        defaultValues={null}
        onSubmit={(v) => create.mutate(v as Omit<Material, "id">)}
        isPending={create.isPending}
      />

      <StockItemsSheet
        material={selectedMaterial}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onMaterialDeleted={() => setSelectedMaterialId(null)}
      />
    </div>
  );
}
