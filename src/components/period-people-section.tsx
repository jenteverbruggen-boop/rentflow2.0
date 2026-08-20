"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LinePricePopover } from "@/components/line-price-popover";
import { PersonTravelEditor } from "@/components/person-travel-editor";
import { formatEUR, personLineCost } from "@/lib/pricing";
import { resolvePersonBasePrice } from "@/lib/person-base-price";
import type { Period, Project } from "@/types";

interface Props {
  period: Period;
  project: Project;
  days: number;
}

/** Extracted from period-bookings.tsx — pure move, no behaviour change
 * (the packing-list feature pushed that file over the 150-line limit). */
export function PeriodPeopleSection({ period, project, days }: Props) {
  const queryClient = useQueryClient();
  const projectKey = ["project", String(project.id)] as const;

  const removePerson = useMutation({
    mutationFn: (assignmentId: number) =>
      fetch(`/api/periods/${period.id}/people/${assignmentId}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: projectKey }),
  });

  return (
    <section>
      <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">👥 Personen</h4>
      {period.people.length === 0 ? (
        <p className="text-xs text-muted-foreground">Geen toegewezen</p>
      ) : (
        <div className="space-y-1.5">
          {period.people.map((pp) => {
            const override = project.personPrices.find((p) => p.personId === pp.personId);
            return (
              <div key={pp.id} className="rounded-md bg-muted/40 px-3 py-1.5">
                <div className="flex items-center gap-2 text-sm">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate flex items-center gap-1.5">
                      {pp.person.name}
                      {pp.overlapAck && <Badge variant="destructive" className="text-[10px]">dubbel geboekt</Badge>}
                    </p>
                    <p className="text-xs text-muted-foreground">{pp.function?.name}</p>
                  </div>
                  <LinePricePopover
                    snapshot={pp.dayPriceSnapshot}
                    basePrice={resolvePersonBasePrice(pp)}
                    override={override ? override.dayPrice : null}
                    resnapshotUrl={`/api/periods/${period.id}/people/${pp.id}`}
                    projectId={project.id}
                    kind="person"
                    entityId={pp.personId}
                    entityName={pp.person.name}
                    invalidateKey={projectKey}
                  />
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {formatEUR(personLineCost(pp, days))}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 hover:text-destructive"
                    onClick={() => removePerson.mutate(pp.id)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
                <PersonTravelEditor
                  periodId={period.id}
                  assignmentId={pp.id}
                  travelCosts={pp.travelCosts ?? []}
                  invalidateKey={projectKey}
                />
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
