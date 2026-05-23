"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProjectForm, type ProjectFormValues } from "@/components/project-form";
import { statusVariant } from "@/lib/utils";
import type { Project } from "@/types";

async function fetchProjects(): Promise<Project[]> {
  const res = await fetch("/api/projects");
  if (!res.ok) throw new Error("Ophalen mislukt");
  return res.json();
}

export default function ProjectsPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);

  const { data: projects = [] } = useQuery({ queryKey: ["projects"], queryFn: fetchProjects });

  const upsert = useMutation({
    mutationFn: async (values: ProjectFormValues) => {
      const url = editing ? `/api/projects/${editing.id}` : "/api/projects";
      const res = await fetch(url, {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) throw new Error("Opslaan mislukt");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setOpen(false);
      setEditing(null);
    },
  });

  const remove = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`/api/projects/${id}`, { method: "DELETE" });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["projects"] }),
  });

  function openCreate() { setEditing(null); setOpen(true); }
  function openEdit(p: Project) { setEditing(p); setOpen(true); }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Projecten</h2>
        <Button onClick={openCreate}>+ Nieuw project</Button>
      </div>

      <div className="space-y-3">
        {projects.map((p) => (
          <Card key={p.id}>
            <CardContent className="flex items-center justify-between py-4">
              <Link href={`/projects/${p.id}`} className="flex-1 hover:opacity-80 min-w-0">
                <p className="font-medium">{p.name}</p>
                <p className="text-sm text-muted-foreground truncate">
                  {[p.client, p.location, format(new Date(p.startDate), "d MMM yyyy", { locale: nl })].filter(Boolean).join(" · ")}
                </p>
              </Link>
              <div className="flex items-center gap-3 ml-4 shrink-0">
                <Badge className={statusVariant(p.status)}>{p.status}</Badge>
                <Button variant="ghost" size="icon" onClick={() => openEdit(p)}>✏️</Button>
                <Button variant="ghost" size="icon" onClick={() => {
                  if (confirm("Project verwijderen?")) remove.mutate(p.id);
                }}>🗑️</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <ProjectForm
        open={open}
        onOpenChange={setOpen}
        defaultValues={editing}
        onSubmit={(values) => upsert.mutate(values)}
        isPending={upsert.isPending}
      />
    </div>
  );
}
