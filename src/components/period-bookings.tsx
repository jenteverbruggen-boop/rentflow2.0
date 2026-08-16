"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { LinePricePopover } from "@/components/line-price-popover";
import { PeriodPeopleSection } from "@/components/period-people-section";
import { PackingListDialog } from "@/components/packing-list-dialog";
import { formatEUR, periodDays } from "@/lib/pricing";
import { groupMaterialAssignments, materialGroupCost } from "@/lib/grouping";
import type { Period, Project } from "@/types";

interface Props {
  period: Period;
  project: Project;
}

export function PeriodBookings({ period, project }: Props) {
  const queryClient = useQueryClient();
  const [packingListOpen, setPackingListOpen] = useState(false);
  const days = periodDays(period);
  const projectKey = ["project", String(project.id)] as const;
  const groups = groupMaterialAssignments(period.materials);

  const removeMaterialAssignment = useMutation({
    mutationFn: (assignmentId: number) =>
      fetch(`/api/periods/${period.id}/materials/${assignmentId}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: projectKey }),
  });

  return (
    <Card>
      <CardContent className="pt-5 space-y-4">
        <PeriodPeopleSection period={period} project={project} days={days} />

        <Separator />

        <section>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-semibold uppercase text-muted-foreground">📦 Materialen</h4>
            {period.materials.length > 0 && (
              <Button variant="outline" size="sm" className="h-6 text-xs" onClick={() => setPackingListOpen(true)}>
                Paklijst
              </Button>
            )}
          </div>
          {groups.length === 0 ? (
            <p className="text-xs text-muted-foreground">Geen toegewezen</p>
          ) : (
            <div className="space-y-1.5">
              {groups.map((g) => {
                const groupCost = materialGroupCost(g, days);
                const override = project.materialPrices.find((p) => p.materialId === g.material.id);
                return (
                  <div key={g.key} className="flex items-center gap-2 bg-muted/40 rounded-md px-3 py-1.5 text-sm">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {g.material.name}{" "}
                        <span className="text-muted-foreground">×{g.units}</span>
                      </p>
                      {g.material.category && (
                        <p className="text-xs text-muted-foreground">{g.material.category}</p>
                      )}
                    </div>
                    <LinePricePopover
                      snapshot={g.dayPriceSnapshot}
                      basePrice={g.material.dayPrice}
                      override={override ? override.dayPrice : null}
                      resnapshotUrl={`/api/periods/${period.id}/materials/${g.assignments[0].id}`}
                      projectId={project.id}
                      kind="material"
                      entityId={g.material.id}
                      entityName={g.material.name}
                      invalidateKey={projectKey}
                    />
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {formatEUR(groupCost)}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 hover:text-destructive"
                      title="Eén unit verwijderen"
                      onClick={() => removeMaterialAssignment.mutate(g.assignments[g.assignments.length - 1].id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </CardContent>
      <PackingListDialog
        period={period}
        project={project}
        open={packingListOpen}
        onOpenChange={setPackingListOpen}
      />
    </Card>
  );
}
