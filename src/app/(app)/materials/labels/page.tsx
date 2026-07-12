"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { MaterialLabel } from "@/components/print/material-label";
import type { Material } from "@/types";

const PRINT_CSS = `
@media print {
  @page { size: A4; margin: 10mm; }
  html, body { background: white !important; }
  body * { visibility: hidden; }
  .label-sheet, .label-sheet * { visibility: visible; }
  .label-sheet { position: absolute; inset: 0; }
  .no-print { display: none !important; }
}
`;

const COLS = 3;
const ROWS = 8;
const PAGE_SIZE = COLS * ROWS;

export default function LabelsPage() {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const origin = typeof window === "undefined" ? "" : window.location.origin;

  const { data: materials = [] } = useQuery<Material[]>({
    queryKey: ["materials"],
    queryFn: () => fetch("/api/materials").then((r) => r.json()),
  });

  const labelMaterials = useMemo(() => {
    if (selectedIds.size === 0) return materials;
    return materials.filter((m) => selectedIds.has(m.id));
  }, [materials, selectedIds]);

  const pages = useMemo(() => {
    const result: Material[][] = [];
    for (let i = 0; i < labelMaterials.length; i += PAGE_SIZE) {
      result.push(labelMaterials.slice(i, i + PAGE_SIZE));
    }
    return result;
  }, [labelMaterials]);

  function toggleAll() {
    if (selectedIds.size === materials.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(materials.map((m) => m.id)));
  }

  function toggleMaterial(id: number) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  }

  return (
    <>
      <style>{PRINT_CSS}</style>

      <div className="no-print p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Materiaallabels — A4 (3×8)</h2>
          <div className="flex gap-2">
            <Button variant="outline" onClick={toggleAll}>
              {selectedIds.size === materials.length
                ? "Alles deselecteren"
                : "Alles selecteren"}
            </Button>
            <Button onClick={() => window.print()}>Afdrukken</Button>
            <Button variant="ghost" onClick={() => window.history.back()}>
              ← Terug
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 max-h-64 overflow-y-auto border rounded-lg p-3">
          {materials.map((m) => (
            <label
              key={m.id}
              className="flex items-center gap-1.5 text-xs cursor-pointer hover:bg-accent rounded px-1 py-0.5"
            >
              <input
                type="checkbox"
                checked={selectedIds.has(m.id)}
                onChange={() => toggleMaterial(m.id)}
              />
              <span className="truncate">{m.name}</span>
            </label>
          ))}
        </div>

        <p className="text-xs text-muted-foreground">
          {selectedIds.size === 0
            ? `Alle ${materials.length}`
            : selectedIds.size}{" "}
          materialen · {pages.length} pagina{pages.length !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="label-sheet">
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
