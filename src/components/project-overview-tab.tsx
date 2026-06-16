"use client";

import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { periodDays, periodTotal, formatEUR } from "@/lib/pricing";
import type { Project } from "@/types";

interface Props {
  project: Project;
  onJumpToPeriod: (periodId: number) => void;
}

export function ProjectOverviewTab({ project, onJumpToPeriod }: Props) {
  const totalDays = project.periods.reduce((acc, p) => acc + periodDays(p), 0);
  const totalPersonBookings = project.periods.reduce((acc, p) => acc + p.people.length, 0);
  const totalMaterialBookings = project.periods.reduce((acc, p) => acc + p.materials.length, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Periodes" value={String(project.periods.length)} />
        <Stat label="Totaal dagen" value={String(totalDays)} />
        <Stat label="Persoonboekingen" value={String(totalPersonBookings)} />
        <Stat label="Materiaalboekingen" value={String(totalMaterialBookings)} />
      </div>

      <Card>
        <CardContent className="pt-5">
          <h3 className="text-sm font-semibold mb-3">Periodes</h3>
          {project.periods.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nog geen periodes</p>
          ) : (
            <div className="space-y-1.5">
              {project.periods.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="w-full flex items-center justify-between bg-muted/40 hover:bg-muted/60 rounded-md px-3 py-2 text-left transition-colors"
                  onClick={() => onJumpToPeriod(p.id)}
                >
                  <div>
                    <p className="text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(p.startDate), "d MMM", { locale: nl })} –{" "}
                      {format(new Date(p.endDate), "d MMM yyyy", { locale: nl })} · {periodDays(p)} d
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary" className="text-xs">👥 {p.people.length}</Badge>
                    <Badge variant="secondary" className="text-xs">📦 {p.materials.length}</Badge>
                    <span className="text-sm font-medium tabular-nums w-24 text-right">
                      {formatEUR(periodTotal(p))}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {project.notes && (
        <Card>
          <CardContent className="pt-5">
            <h3 className="text-sm font-semibold mb-2">Notities</h3>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{project.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold mt-1">{value}</p>
      </CardContent>
    </Card>
  );
}
