"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PersonForm } from "@/components/person-form";
import type { Person } from "@/types";

async function fetchPeople(): Promise<Person[]> {
  const res = await fetch("/api/people");
  if (!res.ok) throw new Error("Ophalen mislukt");
  return res.json();
}

export default function PeoplePage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Person | null>(null);

  const { data: people = [] } = useQuery({ queryKey: ["people"], queryFn: fetchPeople });

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

  function openCreate() {
    setEditing(null);
    setOpen(true);
  }

  function openEdit(person: Person) {
    setEditing(person);
    setOpen(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Personen</h2>
        <Button onClick={openCreate}>+ Nieuwe persoon</Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {people.map((p) => (
          <Card key={p.id}>
            <CardContent className="flex justify-between items-start pt-5">
              <div>
                <p className="font-medium">{p.name}</p>
                {p.role && <p className="text-sm text-muted-foreground">{p.role}</p>}
                {p.email && <p className="text-xs text-muted-foreground/70">{p.email}</p>}
              </div>
              <div className="flex gap-2 shrink-0">
                <Button variant="ghost" size="icon" onClick={() => openEdit(p)}>✏️</Button>
                <Button variant="ghost" size="icon" onClick={() => {
                  if (confirm("Persoon verwijderen?")) remove.mutate(p.id);
                }}>🗑️</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <PersonForm
        open={open}
        onOpenChange={setOpen}
        defaultValues={editing}
        onSubmit={(values) => upsert.mutate(values as Omit<Person, "id">)}
        isPending={upsert.isPending}
      />
    </div>
  );
}
