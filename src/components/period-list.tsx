"use client";

import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { AlertTriangle, Pencil, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { periodDays } from "@/lib/pricing";
import type { Period, Project } from "@/types";

interface Props {
  periods: Period[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  onAdd: () => void;
  onEdit: (period: Period) => void;
  onDelete: (period: Period) => void;
  project: Project;
}

function outOfRange(period: Period, project: Project): boolean {
  return (
    new Date(period.startDate) < new Date(project.startDate) ||
    new Date(period.endDate) > new Date(project.endDate)
  );
}

export function PeriodList({ periods, selectedId, onSelect, onAdd, onEdit, onDelete, project }: Props) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold">Periodes</h3>
        <Button size="sm" variant="outline" onClick={onAdd}>+ Periode</Button>
      </div>
      {periods.length === 0 && (
        <p className="text-xs text-muted-foreground py-4">Nog geen periodes</p>
      )}
      {periods.map((p) => {
        const isSelected = p.id === selectedId;
        const oor = outOfRange(p, project);
        return (
          <Card
            key={p.id}
            className={cn(
              "p-3 cursor-pointer hover:border-primary transition-colors",
              isSelected && "border-primary bg-muted/40"
            )}
            onClick={() => onSelect(p.id)}
          >
            <div className="flex justify-between items-start gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate flex items-center gap-1.5">
                  {p.name}
                  {oor && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                      </TooltipTrigger>
                      <TooltipContent>Buiten projectperiode</TooltipContent>
                    </Tooltip>
                  )}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {format(new Date(p.startDate), "d MMM", { locale: nl })} –{" "}
                  {format(new Date(p.endDate), "d MMM yyyy", { locale: nl })} · {periodDays(p)} d
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  👥 {p.people.length} · 📦 {p.materials.length}
                </p>
              </div>
              <div className="flex flex-col gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={(e) => { e.stopPropagation(); onEdit(p); }}
                >
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 hover:text-destructive"
                  onClick={(e) => { e.stopPropagation(); onDelete(p); }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
