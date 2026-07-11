"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ProjectForm, type ProjectFormValues } from "@/components/project-form";
import type { Project } from "@/types";

interface ProjectEditButtonProps {
  project: Project;
}

export function ProjectEditButton({ project }: ProjectEditButtonProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const update = useMutation({
    mutationFn: async (values: ProjectFormValues) => {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) throw new Error("Opslaan mislukt");
    },
    onSuccess: () => {
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
    </>
  );
}
