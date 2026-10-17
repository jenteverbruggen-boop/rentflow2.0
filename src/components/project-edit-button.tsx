"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ProjectForm, type ProjectFormValues } from "@/components/project-form";
import { OverbookBlockDialog } from "@/components/overbook-block-dialog";
import { CancelReleaseDialog } from "@/components/cancel-release-dialog";
import type { BlockingShortage } from "@/hooks/use-project-status-mutation";
import type { Project, ProjectReleaseSummary } from "@/types";

interface SaveError extends Error {
  shortages?: BlockingShortage[];
}

interface ProjectEditButtonProps {
  project: Project;
}

export function ProjectEditButton({ project }: ProjectEditButtonProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  // Cancelling through this form behaves like the status select: a 409 lists
  // the overbooked lines, a success lists what was released.
  const [blocked, setBlocked] = useState<BlockingShortage[] | null>(null);
  const [error, setError] = useState("");
  const [released, setReleased] = useState<ProjectReleaseSummary | null>(null);

  const update = useMutation({
    mutationFn: async (values: ProjectFormValues) => {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = new Error(data.error ?? "Opslaan mislukt") as SaveError;
        if (res.status === 409 && Array.isArray(data.shortages)) err.shortages = data.shortages;
        throw err;
      }
      return data as { release?: ProjectReleaseSummary };
    },
    onMutate: () => {
      setBlocked(null);
      setError("");
    },
    onError: (err: SaveError) => {
      if (err.shortages?.length) setBlocked(err.shortages);
      else setError(err.message);
    },
    onSuccess: (data) => {
      if (data.release) setReleased(data.release);
      queryClient.invalidateQueries({ queryKey: ["available"] });
      queryClient.invalidateQueries({
        queryKey: ["project", String(project.id)],
      });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setOpen(false);
    },
  });

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Bewerken
      </Button>
      <ProjectForm
        open={open}
        onOpenChange={setOpen}
        defaultValues={project}
        onSubmit={(values) => update.mutate(values)}
        isPending={update.isPending}
      />
      <OverbookBlockDialog
        shortages={blocked}
        message={error || undefined}
        onClose={() => {
          setBlocked(null);
          setError("");
        }}
      />
      <CancelReleaseDialog summary={released} onClose={() => setReleased(null)} />
    </>
  );
}
