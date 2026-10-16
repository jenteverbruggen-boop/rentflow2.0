"use client";

import { useState } from "react";
import { Truck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SubhireDialog, type SubhireTarget } from "@/components/subhire-dialog";
import { useAuthMe } from "@/hooks/use-auth-me";
import { useSubhire } from "@/hooks/use-subhire";
import { canSeeMoney } from "@/lib/me-access";
import { formatEUR, periodDays } from "@/lib/pricing";
import { subhireTotal } from "@/lib/subhire-cost";
import type { Project } from "@/types";

/** The material hired in for this project: what, from whom and (for a caller
 * who may see money) what it costs. Each row can be changed or undone — undone
 * means the units are an open shortage again. Nothing here for a project with
 * no hires. */
export function ProjectSubhireList({ project }: { project: Project }) {
  const { data: me } = useAuthMe();
  const money = canSeeMoney(me);
  const { undo } = useSubhire(project.id);
  const [editing, setEditing] = useState<SubhireTarget | null>(null);

  const rows = project.periods.flatMap((period) =>
    (period.shortages ?? [])
      .filter((s) => s.supplierId != null)
      .map((s) => ({ period, s, total: subhireTotal(s, periodDays(period)) })),
  );
  if (rows.length === 0) return null;
  const totalCost = rows.reduce((sum, r) => sum + (r.total ?? 0), 0);
  const incomplete = rows.some((r) => r.total == null);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base"><Truck className="h-4 w-4" aria-hidden /> Ingehuurd materiaal</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {rows.map(({ period, s, total }) => (
          <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/40">
            <div className="min-w-0">
              <p className="truncate"><b>{s.quantity}×</b> {s.material.name} <span className="text-muted-foreground">· {period.name}</span></p>
              <p className="text-xs text-muted-foreground">
                via {s.supplier?.name ?? "leverancier"}
                {money && (total != null ? ` · inkoop ${formatEUR(total)}` : " · inkoopprijs onbekend")}
              </p>
            </div>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs"
                onClick={() => setEditing({
                  mode: "edit", periodId: period.id, shortageId: s.id, materialName: s.material.name, quantity: s.quantity,
                  supplierId: s.supplierId ?? null, basis: s.subhireCostBasis ?? "per_huur", unitCost: s.subhireUnitCost ?? null,
                  costOverride: s.subhireCostOverride ?? null,
                })}>
                Wijzig
              </Button>
              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" disabled={undo.isPending}
                onClick={() => undo.mutate({ periodId: period.id, shortageId: s.id })}>
                Ongedaan maken
              </Button>
            </div>
          </div>
        ))}
        {money && <p className="px-2 pt-1 text-xs text-muted-foreground">Totale inkoop inhuur: <b>{formatEUR(totalCost)}</b>{incomplete && " (nog niet alle prijzen ingevuld)"}</p>}
        {undo.isError && <p className="px-2 text-xs text-destructive">{undo.error.message}</p>}
      </CardContent>
      <SubhireDialog projectId={project.id} target={editing} onClose={() => setEditing(null)} />
    </Card>
  );
}
