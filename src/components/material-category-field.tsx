"use client";

import { useState } from "react";
import { EntityCombobox } from "@/components/entity-combobox";
import { useCategories } from "@/hooks/use-categories";
import type { Material } from "@/types";

interface MaterialCategoryFieldProps {
  material: Material;
  onSave: (categoryId: number | null) => Promise<void>;
}

// B3 — replaces the plain-text InlineEditField that used to write the
// legacy `Material.category` string here. Every display surface reads
// `categoryRel?.name ?? category`, so once a material has a categoryId,
// editing the legacy string was a silent no-op. This mirrors the
// EntityCombobox pattern material-form.tsx already uses for create/edit.
export function MaterialCategoryField({ material, onSave }: MaterialCategoryFieldProps) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const { categories, createCategory } = useCategories();

  const displayName = material.categoryRel?.name ?? material.category ?? "—";

  async function handleChange(id: number | null) {
    setSaving(true);
    try {
      await onSave(id);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div className="rounded-md border border-border p-3">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs text-muted-foreground">Categorie</p>
          <button
            onClick={() => setEditing(false)}
            disabled={saving}
            className="text-muted-foreground hover:opacity-70 text-sm px-1"
            title="Annuleren"
          >
            ✕
          </button>
        </div>
        <EntityCombobox
          items={categories}
          value={material.categoryId}
          onChange={handleChange}
          onCreate={createCategory}
          placeholder="Selecteer categorie..."
          createLabel="+ Nieuwe categorie"
          disabled={saving}
        />
      </div>
    );
  }

  return (
    <button
      className="rounded-md border border-border p-3 text-left w-full hover:bg-accent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={() => setEditing(true)}
      title="Klik om te bewerken"
    >
      <p className="text-xs text-muted-foreground">Categorie</p>
      <p className="font-medium text-sm">{displayName}</p>
    </button>
  );
}
