"use client";

import Link from "next/link";
import { format, isSameDay, isSameMonth } from "date-fns";
import { nl } from "date-fns/locale";
import { Card } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { cn, statusVariant } from "@/lib/utils";
import type { Project } from "@/types";

export interface MonthDayCell {
  date: Date;
  projects: Project[];
}

interface Props {
  month: Date;
  days: MonthDayCell[];
}

const VISIBLE_LIMIT = 3;
const WEEKDAY_LABELS = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"];

/** I1.2 — leading/trailing-padded month grid; a cell showing more
 * than fits expands via a popover on click (Q20) rather than
 * truncating silently. */
export function PlanningMonthGrid({ month, days }: Props) {
  return (
    <div className="grid grid-cols-7 gap-1">
      {WEEKDAY_LABELS.map((d) => (
        <div key={d} className="text-xs text-muted-foreground text-center pb-1">{d}</div>
      ))}
      {days.map(({ date, projects }) => {
        const isToday = isSameDay(date, new Date());
        const inMonth = isSameMonth(date, month);
        const visible = projects.slice(0, VISIBLE_LIMIT);
        const overflow = projects.length - visible.length;
        return (
          <Card
            key={date.toISOString()}
            className={cn("min-h-24 p-2", isToday && "border-primary", !inMonth && "opacity-40")}
          >
            <p className={cn("text-xs font-semibold mb-1", isToday ? "text-primary" : "text-muted-foreground")}>
              {format(date, "d", { locale: nl })}
            </p>
            <div className="space-y-0.5">
              {visible.map((p) => (
                <Link
                  key={p.id}
                  href={`/projects/${p.id}`}
                  className={cn("block truncate text-[10px] rounded px-1", statusVariant(p.status))}
                >
                  {p.name}
                </Link>
              ))}
              {overflow > 0 && (
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="text-[10px] text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring rounded">
                      +{overflow} meer
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 space-y-1" align="start">
                    <p className="text-xs font-semibold mb-1">{format(date, "d MMM yyyy", { locale: nl })}</p>
                    {projects.map((p) => (
                      <Link
                        key={p.id}
                        href={`/projects/${p.id}`}
                        className="flex items-center justify-between gap-2 text-xs hover:bg-accent px-2 py-1 rounded"
                      >
                        <span className="truncate">{p.name}</span>
                        <Badge className={statusVariant(p.status)}>{p.status}</Badge>
                      </Link>
                    ))}
                  </PopoverContent>
                </Popover>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
