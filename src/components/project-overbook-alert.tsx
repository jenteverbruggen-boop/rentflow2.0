"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { projectShortageLines } from "@/lib/project-shortages";
import type { Project } from "@/types";

interface Props {
  project: Project;
}

interface FillResult {
  filled: number;
  remaining: unknown[];
}

/**
 * Overboeken — the persistent project-level warning. Derived from the
 * project payload (not from a transient mutation result), so it survives a
 * reload for as long as units are still overbooked. "Toewijzen" retries
 * every open shortage against stock that has since been bought or freed
 * up — the same call the status gate makes before it blocks.
 */
export function ProjectOverbookAlert({ project }: Props) {
  const queryClient = useQueryClient();
  const lines = projectShortageLines(project);
  const anyPeriodId = lines[0]?.periodId;

  const fill = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/periods/${anyPeriodId}/shortages/fill`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Toewijzen mislukt");
      return data as FillResult;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["project", String(project.id)],
      });
      queryClient.invalidateQueries({ queryKey: ["available"] });
    },
  });

  if (lines.length === 0) {
    // Only report the outcome while the banner still has a reason to exist;
    // once everything is assigned the alert disappears with it.
    if (fill.isSuccess && fill.data.filled > 0) {
      return (
        <Alert>
          <AlertDescription className="text-emerald-600 dark:text-emerald-500">
            ✓ {fill.data.filled} overboekte unit(s) toegewezen aan voorraad.
          </AlertDescription>
        </Alert>
      );
    }
    return null;
  }

  const total = lines.reduce((s, l) => s + l.quantity, 0);

  return (
    <Alert className="border-amber-500/40">
      <AlertDescription>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="text-amber-600 dark:text-amber-500 space-y-0.5">
            <p className="font-medium">
              ⚠ {total} unit(s) overboekt — niet in voorraad
            </p>
            {lines.map((l) => (
              <p key={l.id} className="text-xs">
                {l.periodName} · {l.materialName} · {l.quantity} overboekt
                {l.isBundleComponent && " (onderdeel van een set)"}
              </p>
            ))}
            <p className="text-xs">
              Het project kan pas naar bevestigd/actief/afgerond als dit is
              opgelost — koop voorraad bij en wijs toe, of verlaag het aantal.
            </p>
            {fill.isSuccess && (
              <p className="text-xs">
                {fill.data.filled > 0
                  ? `${fill.data.filled} unit(s) toegewezen, ${total} nog open.`
                  : "Geen extra voorraad beschikbaar om toe te wijzen."}
              </p>
            )}
            {fill.isError && (
              <p className="text-xs text-destructive">{fill.error.message}</p>
            )}
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={fill.isPending || anyPeriodId == null}
            onClick={() => fill.mutate()}
          >
            {fill.isPending ? "Bezig…" : "Toewijzen"}
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
