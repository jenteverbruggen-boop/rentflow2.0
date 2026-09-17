"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { MaterialLabel } from "@/components/print/material-label";
import type { MaterialSort, MaterialTypeFilter } from "@/components/materials-filter-bar";
import { useMaterialFilters } from "@/hooks/use-material-filters";
import { resolveLabelMaterials } from "@/lib/label-selection";
import { LabelMaterialPicker } from "./label-material-picker";
import type { Material } from "@/types";

// J3 — visibility is handled by the shared .print-root rules in
// globals.css; only this page's tighter @page margin is genuinely
// different (the label grid assumes 10mm, not the shared 1.5cm) so it
// stays as a small local override.
const PRINT_CSS = `
@media print {
  @page { size: A4; margin: 10mm; }
}
`;

const COLS = 3;
const ROWS = 8;
const PAGE_SIZE = COLS * ROWS;

export default function LabelsPage() {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState<MaterialSort>("name-asc");
  const [typeFilter, setTypeFilter] = useState<MaterialTypeFilter>("all");
  const origin = typeof window === "undefined" ? "" : window.location.origin;

  const { data: materials = [] } = useQuery<Material[]>({
    queryKey: ["materials"],
    queryFn: () => fetch("/api/materials").then((r) => r.json()),
  });

  const { categories, filtered } = useMaterialFilters({
    materials,
    search,
    category,
    sort,
    typeFilter,
  });

  // Nothing ticked = print every filtered/visible material. Otherwise
  // selectedIds is the source of truth, even for ids the current filter
  // hides — see src/lib/label-selection.ts.
  const labelMaterials = useMemo(
    () => resolveLabelMaterials(materials, filtered, selectedIds),
    [materials, filtered, selectedIds],
  );

  const pages = useMemo(() => {
    const result: Material[][] = [];
    for (let i = 0; i < labelMaterials.length; i += PAGE_SIZE) {
      result.push(labelMaterials.slice(i, i + PAGE_SIZE));
    }
    return result;
  }, [labelMaterials]);

  return (
    <>
      <style>{PRINT_CSS}</style>

      <div className="no-print p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Materiaallabels — A4 (3×8)</h2>
          <div className="flex gap-2">
            <Button onClick={() => window.print()}>Afdrukken</Button>
            <Button variant="ghost" onClick={() => window.history.back()}>
              ← Terug
            </Button>
          </div>
        </div>

        <LabelMaterialPicker
          materials={filtered}
          categories={categories}
          search={search}
          onSearchChange={setSearch}
          category={category}
          onCategoryChange={setCategory}
          sort={sort}
          onSortChange={setSort}
          typeFilter={typeFilter}
          onTypeFilterChange={setTypeFilter}
          selectedIds={selectedIds}
          onSelectedIdsChange={setSelectedIds}
        />

        <p className="text-xs text-muted-foreground">
          {selectedIds.size === 0
            ? `Niets geselecteerd — alle ${filtered.length} gefilterde materialen worden afgedrukt`
            : `${selectedIds.size} van ${filtered.length} geselecteerd`}{" "}
          · {pages.length} pagina{pages.length !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="print-root label-sheet">
        {pages.map((page, pi) => (
          <div
            key={pi}
            style={{
              width: "210mm",
              minHeight: "297mm",
              pageBreakAfter: pi < pages.length - 1 ? "always" : "auto",
              padding: "10mm",
              boxSizing: "border-box",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${COLS}, 1fr)`,
                gridTemplateRows: `repeat(${ROWS}, 1fr)`,
                gap: "2mm",
                height: "277mm",
              }}
            >
              {page.map((m) => (
                <MaterialLabel key={m.id} material={m} origin={origin} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
