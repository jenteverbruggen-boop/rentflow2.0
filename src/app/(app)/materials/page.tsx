"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MaterialForm } from "@/components/material-form";
import type { Material } from "@/types";

async function fetchMaterials(): Promise<Material[]> {
  const res = await fetch("/api/materials");
  if (!res.ok) throw new Error("Ophalen mislukt");
  return res.json();
}

export default function MaterialsPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Material | null>(null);

  const { data: materials = [] } = useQuery({ queryKey: ["materials"], queryFn: fetchMaterials });

  const upsert = useMutation({
    mutationFn: async (values: Omit<Material, "id">) => {
      const url = editing ? `/api/materials/${editing.id}` : "/api/materials";
      const res = await fetch(url, {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) throw new Error("Opslaan mislukt");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["materials"] });
      setOpen(false);
      setEditing(null);
    },
  });

  const remove = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`/api/materials/${id}`, { method: "DELETE" });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["materials"] }),
  });

  function openCreate() { setEditing(null); setOpen(true); }
  function openEdit(m: Material) { setEditing(m); setOpen(true); }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Materialen</h2>
        <Button onClick={openCreate}>+ Nieuw materiaal</Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {materials.map((m) => (
          <Card key={m.id}>
            <CardContent className="flex justify-between items-start pt-5">
              <div className="space-y-1">
                <p className="font-medium">{m.name}</p>
                {m.category && <Badge variant="secondary">{m.category}</Badge>}
                <p className="text-xs text-muted-foreground">Voorraad: {m.totalStock}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button variant="ghost" size="icon" onClick={() => openEdit(m)}>✏️</Button>
                <Button variant="ghost" size="icon" onClick={() => {
                  if (confirm("Materiaal verwijderen?")) remove.mutate(m.id);
                }}>🗑️</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <MaterialForm
        open={open}
        onOpenChange={setOpen}
        defaultValues={editing}
        onSubmit={(values) => upsert.mutate(values as Omit<Material, "id">)}
        isPending={upsert.isPending}
      />
    </div>
  );
}
