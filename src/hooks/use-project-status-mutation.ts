import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Project, ProjectStatus } from "@/types";

/** Shape of the 409 the PUT route returns when the project still has
 * overbooked material — mirrors ProjectShortage in material-shortage-db.ts
 * (server-only module, so the wire shape is restated here). */
export interface BlockingShortage {
  id: number;
  periodName: string;
  materialName: string;
  quantity: number;
}

interface StatusError extends Error {
  shortages?: BlockingShortage[];
}

/**
 * The status dropdown's mutation, extracted so status-select.tsx stays
 * ≤150 lines. Two things it does that the old inline version did not:
 * it reads the response body (a blocked status change used to roll the
 * optimistic update back and tell the user nothing at all), and it sends
 * clientId/locationId — the route writes `clientId ?? null`, so omitting
 * them silently unlinked the project's client and location on every
 * status change.
 */
export function useProjectStatusMutation(project: Project) {
  const queryClient = useQueryClient();
  const [blocked, setBlocked] = useState<BlockingShortage[] | null>(null);
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: async (newStatus: ProjectStatus) => {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: project.name,
          client: project.client,
          clientId: project.clientId,
          location: project.location,
          locationId: project.locationId,
          startDate: project.startDate,
          endDate: project.endDate,
          notes: project.notes,
          status: newStatus,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = new Error(
          data.error ?? "Status wijzigen mislukt",
        ) as StatusError;
        if (res.status === 409 && Array.isArray(data.shortages))
          err.shortages = data.shortages;
        throw err;
      }
      return data;
    },
    onMutate: async (newStatus) => {
      setBlocked(null);
      setError("");
      await queryClient.cancelQueries({
        queryKey: ["project", String(project.id)],
      });
      const prev = queryClient.getQueryData<Project>([
        "project",
        String(project.id),
      ]);
      queryClient.setQueryData(
        ["project", String(project.id)],
        (old: Project) => ({ ...old, status: newStatus }),
      );
      return { prev };
    },
    onError: (err: StatusError, _vars, ctx) => {
      if (ctx?.prev)
        queryClient.setQueryData(["project", String(project.id)], ctx.prev);
      if (err.shortages?.length) setBlocked(err.shortages);
      else setError(err.message);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({
        queryKey: ["project", String(project.id)],
      });
    },
  });

  return {
    mutation,
    blocked,
    dismissBlocked: () => setBlocked(null),
    error,
    dismissError: () => setError(""),
  };
}
