"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { PersonForm } from "@/components/person-form";
import { PersonCard } from "./person-card";
import { PersonLinkSuggestionsBanner } from "@/components/person-link-suggestions-banner";
import { FunctionsManagerDialog } from "@/components/functions-manager-dialog";
import type { Person } from "@/types";

async function fetchPeople(): Promise<Person[]> {
  const res = await fetch("/api/people");
  if (!res.ok) throw new Error("Ophalen mislukt");
  return res.json();
}

export default function PeoplePage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [functionsOpen, setFunctionsOpen] = useState(false);
  const [editing, setEditing] = useState<Person | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data: people = [] } = useQuery({
    queryKey: ["people"],
    queryFn: fetchPeople,
  });

  const upsert = useMutation({
    mutationFn: async (values: Omit<Person, "id">) => {
      const url = editing ? `/api/people/${editing.id}` : "/api/people";
      const res = await fetch(url, {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) throw new Error("Opslaan mislukt");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["people"] });
      setOpen(false);
      setEditing(null);
    },
  });

  const remove = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`/api/people/${id}`, { method: "DELETE" });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["people"] }),
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Personen</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setFunctionsOpen(true)}>Functies</Button>
          <a href="/api/people/export" target="_blank" rel="noreferrer">
            <Button variant="outline">⬇️ Exporteren</Button>
          </a>
          <Button onClick={() => { setEditing(null); setOpen(true); }}>+ Nieuwe persoon</Button>
        </div>
      </div>

      <PersonLinkSuggestionsBanner />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {people.map((p) => (
          <PersonCard
            key={p.id}
            person={p}
            expanded={expandedId === p.id}
            onToggle={() => setExpandedId(expandedId === p.id ? null : p.id)}
            onEdit={() => { setEditing(p); setOpen(true); }}
            onDelete={() => { if (confirm("Verwijderen?")) remove.mutate(p.id); }}
          />
        ))}
      </div>

      <PersonForm
        open={open}
        onOpenChange={setOpen}
        defaultValues={editing}
        onSubmit={(values) =>
          upsert.mutate(values as unknown as Omit<Person, "id">)
        }
        isPending={upsert.isPending}
      />
      <FunctionsManagerDialog open={functionsOpen} onOpenChange={setFunctionsOpen} />
    </div>
  );
}
