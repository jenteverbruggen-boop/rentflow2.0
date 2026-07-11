"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { PersonForm } from "@/components/person-form";
import { PersonDocuments } from "@/components/person-documents";
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
        <Button
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          + Nieuwe persoon
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {people.map((p) => (
          <Card
            key={p.id}
            className="cursor-pointer"
            onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
          >
            <CardContent className="pt-4 space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium">{p.name}</p>
                  {p.functions && p.functions.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {p.functions.map((f) => (
                        <Badge
                          key={f.id}
                          variant="secondary"
                          className="text-xs"
                        >
                          {f.name}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {p.email && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {p.email}
                    </p>
                  )}
                </div>
                <div
                  className="flex gap-1 shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => {
                      setEditing(p);
                      setOpen(true);
                    }}
                  >
                    ✏️
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => {
                      if (confirm("Verwijderen?")) remove.mutate(p.id);
                    }}
                  >
                    🗑️
                  </Button>
                </div>
              </div>
              {expandedId === p.id && (
                <div onClick={(e) => e.stopPropagation()}>
                  <Separator className="my-2" />
                  <PersonDocuments personId={p.id} />
                </div>
              )}
            </CardContent>
          </Card>
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
    </div>
  );
}
