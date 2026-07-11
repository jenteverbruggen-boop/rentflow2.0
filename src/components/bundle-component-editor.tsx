"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EntityCombobox } from "@/components/entity-combobox";
import { formatEUR } from "@/lib/pricing";
import type { Material, MaterialComponent } from "@/types";

interface BundleComponentEditorProps {
  material: Material;
}

export function BundleComponentEditor({ material }: BundleComponentEditorProps) {
  const queryClient = useQueryClient();
  const [selectedChildId, setSelectedChildId] = useState<number | null>(null);
  const [qty, setQty] = useState(1);

  const { data: allMaterials = [] } = useQuery<Material[]>({
    queryKey: ["materials"],
    queryFn: () => fetch("/api/materials").then((r) => r.json()),
  });

  const { data: components = [] } = useQuery<MaterialComponent[]>({
    queryKey: ["material-components", material.id],
    queryFn: () => fetch(`/api/materials/${material.id}/components`).then((r) => r.json()),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["material-components", material.id] });
    queryClient.invalidateQueries({ queryKey: ["materials"] });
  };

  const addComponent = useMutation({
    mutationFn: async () => {
      if (!selectedChildId) return;
      const res = await fetch(`/api/materials/${material.id}/components`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ childId: selectedChildId, quantity: qty }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Mislukt");
    },
    onSuccess: () => { invalidate(); setSelectedChildId(null); setQty(1); },
  });

  const removeComponent = useMutation({
    mutationFn: (componentId: number) =>
      fetch(`/api/materials/${material.id}/components/${componentId}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });

  const nonBundles = allMaterials.filter((m) => !m.isBundle && m.id !== material.id);
  const usedIds = new Set(components.map((c) => c.childId));
  const available = nonBundles.filter((m) => !usedIds.has(m.id));

  const liveSum = components.reduce((acc, c) => {
    const child = allMaterials.find((m) => m.id === c.childId);
    return acc + (child?.dayPrice ?? 0) * c.quantity;
  }, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Componenten</p>
        <p className="text-xs text-muted-foreground">
          {material.bundlePriceOverride != null ? formatEUR(material.bundlePriceOverride) : `${formatEUR(liveSum)} (automatisch)`}/d
        </p>
      </div>

      {components.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nog geen componenten</p>
      ) : (
        <div className="space-y-1">
          {components.map((c) => {
            const child = allMaterials.find((m) => m.id === c.childId);
            return (
              <div key={c.id} className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-xs">
                <span className="flex-1">{child?.name ?? `#${c.childId}`} × {c.quantity}</span>
                {child && <span className="text-muted-foreground">{formatEUR(child.dayPrice * c.quantity)}/d</span>}
                <Button size="icon" variant="ghost" className="h-6 w-6 hover:text-destructive" onClick={() => removeComponent.mutate(c.id)}>✕</Button>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <EntityCombobox
            items={available.map((m) => ({ id: m.id, name: m.name }))}
            value={selectedChildId}
            onChange={setSelectedChildId}
            placeholder="Component toevoegen..."
          />
        </div>
        <Input type="number" min={1} value={qty} onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))} className="w-16 h-9 text-sm" />
        <Button size="sm" disabled={!selectedChildId || addComponent.isPending} onClick={() => addComponent.mutate()}>+</Button>
      </div>
    </div>
  );
}
