"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { statusVariant } from "@/lib/utils";
import type { Project, ProjectStatus } from "@/types";

const STATUSES: ProjectStatus[] = ["concept", "bevestigd", "actief", "afgerond", "geannuleerd"];

interface StatusSelectProps {
  project: Project;
}

export function StatusSelect({ project }: StatusSelectProps) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (newStatus: ProjectStatus) => {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: project.name,
          client: project.client,
          location: project.location,
          startDate: project.startDate,
          endDate: project.endDate,
          notes: project.notes,
          status: newStatus,
        }),
      });
      if (!res.ok) throw new Error("Status wijzigen mislukt");
      return res.json();
    },
    onMutate: async (newStatus) => {
      await queryClient.cancelQueries({ queryKey: ["project", String(project.id)] });
      const prev = queryClient.getQueryData<Project>(["project", String(project.id)]);
      queryClient.setQueryData(["project", String(project.id)], (old: Project) => ({
        ...old,
        status: newStatus,
      }));
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["project", String(project.id)], ctx.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["project", String(project.id)] });
    },
  });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-1 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Badge className={statusVariant(project.status)}>{project.status}</Badge>
          <span className="text-muted-foreground text-xs">▾</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {STATUSES.map((s) => (
          <DropdownMenuItem
            key={s}
            onSelect={() => mutation.mutate(s)}
            className="cursor-pointer"
          >
            <Badge className={statusVariant(s)}>{s}</Badge>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
