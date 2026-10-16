"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { ProjectList } from "@/components/project-list";
import { ProjectsToolbar } from "@/components/projects-toolbar";
import {
  filterProjects, hiddenByStatus, parseStatusParam, serializeStatusParam,
  type ProjectStatusFilter,
} from "@/lib/project-filter";
import { PageActionsMenu } from "@/components/page-actions-menu";
import { ProjectForm, type ProjectFormValues } from "@/components/project-form";
import type { Project } from "@/types";
import { Download } from "lucide-react";

async function fetchProjects(): Promise<Project[]> {
  const res = await fetch("/api/projects");
  if (!res.ok) throw new Error("Ophalen mislukt");
  return res.json();
}

function ProjectsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
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
  const statusFilter = parseStatusParam(searchParams.get("status"));
  function setStatusFilter(next: ProjectStatusFilter) {
    const params = new URLSearchParams(searchParams.toString());
    const serialized = serializeStatusParam(next);
    if (serialized === null) params.delete("status");
    else params.set("status", serialized);
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : "?", { scroll: false });
  }
  const [query, setQuery] = useState("");
  const visible = filterProjects(projects, statusFilter, query);

  function openEdit(p: Project) { setEditing(p); setOpen(true); }

  return (
    <div className="space-y-6">
      <PageHeader title="Projecten">
        <PageActionsMenu actions={[{ label: "Exporteren", icon: Download, href: "/api/projects/export" }]} />
        <Button onClick={openCreate}>+ Nieuw project</Button>
      </PageHeader>

      <ProjectsToolbar
        query={query}
        onQueryChange={setQuery}
        status={statusFilter}
        onStatusChange={setStatusFilter}
        hidden={hiddenByStatus(projects, statusFilter, query)}
      />

      {visible.length === 0 && (
        <p className="text-muted-foreground text-sm">Geen projecten gevonden.</p>
      )}

      <ProjectList
        projects={visible}
        onEdit={openEdit}
        onDelete={(p) => { if (confirm("Project verwijderen?")) remove.mutate(p.id); }}
      />

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

export default function ProjectsPage() {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Laden...</p>}>
      <ProjectsPageContent />
    </Suspense>
  );
}
