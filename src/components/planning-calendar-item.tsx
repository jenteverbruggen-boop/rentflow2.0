"use client";

import Link from "next/link";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn, statusVariant } from "@/lib/utils";
import type { Project } from "@/types";

interface PlanningCalendarItemProps {
  project: Project;
  people: number;
  materials: number;
}

export function PlanningCalendarItem({ project, people, materials }: PlanningCalendarItemProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "w-full text-left rounded px-2 py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            statusVariant(project.status)
          )}
        >
          <p className="text-xs font-medium truncate">{project.name}</p>
          {project.location && <p className="text-xs opacity-70 truncate">{project.location}</p>}
          <div className="flex gap-2 mt-0.5">
            {people > 0 && <span className="text-xs opacity-70">👥 {people}</span>}
            {materials > 0 && <span className="text-xs opacity-70">📦 {materials}</span>}
          </div>
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
            {format(new Date(project.startDate), "d MMM yyyy", { locale: nl })} –{" "}
            {format(new Date(project.endDate), "d MMM yyyy", { locale: nl })}
          </p>
          <p>👥 {people} personen · 📦 {materials} materialen</p>
        </div>
        <Link
          href={`/projects/${project.id}`}
          className="text-xs text-primary hover:underline block"
        >
          Naar project →
        </Link>
      </PopoverContent>
    </Popover>
  );
}
