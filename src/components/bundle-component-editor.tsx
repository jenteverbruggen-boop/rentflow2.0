"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EntityCombobox } from "@/components/entity-combobox";
import { BundleComponentRow } from "@/components/bundle-component-row";
import { useBundleEditor } from "@/hooks/use-bundle-editor";
import { useMaterialUpdate } from "@/hooks/use-material-update";
import { formatEUR } from "@/lib/pricing";
import type { Material } from "@/types";

interface BundleComponentEditorProps {
  material: Material;
}

export function BundleComponentEditor({ material }: BundleComponentEditorProps) {
  const { allMaterials, components, addComponent, updateQuantity, removeComponent } =
    useBundleEditor(material.id);
  const saveField = useMaterialUpdate(material);

  const [selectedChildId, setSelectedChildId] = useState<number | null>(null);
  const [qty, setQty] = useState(1);
  const [override, setOverride] = useState(
    material.bundlePriceOverride != null ? String(material.bundlePriceOverride) : "",
  );

  const available = allMaterials.filter(
    (m) => !m.isBundle && m.id !== material.id,
  );

  const sharingHint = (childId: number): string | null => {
    const sets = allMaterials
      .filter((m) => m.isBundle && m.id !== material.id && (m.components ?? []).some((c) => c.childId === childId))
      .map((m) => m.name);
    return sets.length > 0 ? `🔗 ook in: ${sets.join(", ")}` : null;
  };

  const liveSum = components.reduce((acc, c) => {
    const child = allMaterials.find((m) => m.id === c.childId);
    return acc + (child?.dayPrice ?? 0) * c.quantity;
  }, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">Componenten</p>
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-muted-foreground">Setprijs</span>
          <Input
            type="number"
            min={0}
            value={override}
            placeholder={liveSum.toFixed(2)}
            onChange={(e) => setOverride(e.target.value)}
            onBlur={() => saveField("bundlePriceOverride", override)}
            className="h-7 w-24 text-xs"
            aria-label="Vaste setprijs (leeg = automatisch)"
          />
          <span className="text-muted-foreground">/d</span>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {override.trim() === ""
          ? `Automatisch: ${formatEUR(liveSum)}/d (som van componenten)`
          : `Vaste prijs — leeg maken voor automatisch (${formatEUR(liveSum)}/d)`}
      </p>

      {components.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nog geen componenten</p>
      ) : (
        <div className="space-y-1">
          {components.map((c) => {
            const sets = allMaterials
              .filter((m) => m.isBundle && m.id !== material.id && (m.components ?? []).some((comp) => comp.childId === c.childId))
              .map((m) => ({ id: m.id, name: m.name }));
            return (
              <BundleComponentRow
                key={`${c.id}-${c.quantity}`}
                component={c}
                child={allMaterials.find((m) => m.id === c.childId)}
                sharedWith={sets.length > 0 ? sets : undefined}
                onQuantityChange={(quantity) =>
                  updateQuantity.mutate({ componentId: c.id, quantity })
                }
                onRemove={() => removeComponent.mutate(c.id)}
              />
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
          {selectedChildId && sharingHint(selectedChildId) && (
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {sharingHint(selectedChildId)}
            </p>
          )}
        </div>
        <Input
          type="number"
          min={1}
          value={qty}
          onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))}
          className="w-16 h-9 text-sm"
          aria-label="Aantal per set"
        />
        <Button
          size="sm"
          disabled={!selectedChildId || addComponent.isPending}
          onClick={() => {
            if (selectedChildId) {
              addComponent.mutate(
                { childId: selectedChildId, quantity: qty },
                {
                  onSuccess: () => {
                    setSelectedChildId(null);
                    setQty(1);
                  },
                },
              );
            }
          }}
        >
          +
        </Button>
      </div>
    </div>
  );
}
