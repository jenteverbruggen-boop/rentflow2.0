"use client";

import Link from "next/link";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn, statusVariant } from "@/lib/utils";
import type { PlanningPeriod, PlanningProject } from "@/lib/planning-include";

interface Props {
  period: PlanningPeriod;
  project: PlanningProject;
}

function fmtTime(d: string) {
  return format(new Date(d), "HH:mm");
}

/** I2.2 — the week/month calendar cell's period entry, replacing
 * planning-calendar-item.tsx's whole-project item: shows the period's
 * own `HH:mm` window (times exist in the data but were never
 * formatted before this), not just the project name. */
export function PlanningPeriodItem({ period, project }: Props) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "w-full text-left rounded px-2 py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            statusVariant(project.status),
          )}
        >
          <p className="text-xs font-medium truncate">{project.name}</p>
          <p className="text-xs opacity-70 truncate">
            {fmtTime(period.startDate)}–{fmtTime(period.endDate)}
            {period.name !== "Hoofdperiode" && ` · ${period.name}`}
          </p>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3 space-y-2" align="start">
        <div>
          <p className="font-semibold text-sm">{project.name}</p>
          {project.client && <p className="text-xs text-muted-foreground">{project.client}</p>}
          {project.location && <p className="text-xs text-muted-foreground">{project.location}</p>}
        </div>
        <div className="flex items-center gap-2">
          <Badge className={statusVariant(project.status)}>{project.status}</Badge>
        </div>
        <div className="text-xs text-muted-foreground space-y-0.5">
          <p>
            {period.name} · {format(new Date(period.startDate), "d MMM yyyy", { locale: nl })}{" "}
            {fmtTime(period.startDate)}–{fmtTime(period.endDate)}
          </p>
          <p>
            👥 {period.peopleCount} personen · 📦 {period.materialsCount} materialen
          </p>
        </div>
        <Link href={`/projects/${project.id}`} className="text-xs text-primary hover:underline block">
          Naar project →
        </Link>
      </PopoverContent>
    </Popover>
  );
}
