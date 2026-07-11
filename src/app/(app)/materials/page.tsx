"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { MaterialForm } from "@/components/material-form";
import { MaterialDetailPane } from "@/components/material-detail-pane";
import { MaterialsTreePane, type MaterialSort } from "@/components/materials-tree-pane";
import { StockItemsSheet } from "@/components/stock-items-sheet";
import { CameraScanner } from "@/components/camera-scanner";
import { useMaterials } from "@/hooks/use-materials";
import type { Material } from "@/types";

export default function MaterialsPage() {
  const { query, create } = useMaterials();
  const materials = query.data ?? [];
  const searchParams = useSearchParams();

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState<MaterialSort>("name-asc");
  const [selectedMaterialId, setSelectedMaterialId] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);

  useEffect(() => {
    const paramId = searchParams.get("materialId");
    if (paramId && materials.length > 0) {
      const id = parseInt(paramId);
      if (materials.some((m) => m.id === id)) setSelectedMaterialId(id);
    }
  }, [searchParams, materials]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    materials.forEach((m) => {
      const cat = m.categoryRel?.name ?? m.category;
      if (cat) set.add(cat);
    });
    return Array.from(set).sort();
  }, [materials]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const matches = materials.filter((m) => {
      const catName = m.categoryRel?.name ?? m.category;
      if (category !== "all" && catName !== category) return false;
      if (!q) return true;
      return m.name.toLowerCase().includes(q) || (catName ?? "").toLowerCase().includes(q);
    });

    if (sort === "stock-desc") return matches.sort((a, b) => (b.totalStock ?? 0) - (a.totalStock ?? 0));
    if (sort === "name-desc") return matches.sort((a, b) => b.name.localeCompare(a.name));
    return matches.sort((a, b) => a.name.localeCompare(b.name));
  }, [materials, search, category, sort]);

  const materialsByCategory = useMemo(() => {
    const grouped = new Map<string, Material[]>();
    for (const material of filtered) {
      const key = material.categoryRel?.name ?? material.category ?? "Zonder categorie";
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
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setScanOpen(true)}>📷 Scan</Button>
          <Button onClick={() => setFormOpen(true)}>+ Nieuw materiaal</Button>
        </div>
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

      <CameraScanner open={scanOpen} onOpenChange={setScanOpen} />
    </div>
  );
}
