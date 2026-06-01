"use client";

import { differenceInCalendarDays, format } from "date-fns";
import { nl } from "date-fns/locale";
import { cn } from "@/lib/utils";

export interface TimelineBar {
  id: string | number;
  startDate: string | Date;
  endDate: string | Date;
  label?: React.ReactNode;
  className?: string;
  highlighted?: boolean;
  onClick?: () => void;
}

export interface TimelineRow {
  id: string | number;
  label: React.ReactNode;
  bars: TimelineBar[];
}

interface Props {
  rows: TimelineRow[];
  rangeStart: string | Date;
  rangeEnd: string | Date;
  showToday?: boolean;
  rowHeight?: number;
  labelWidth?: number;
  emptyMessage?: string;
}

function pct(d: Date, start: Date, total: number): number {
  const offset = differenceInCalendarDays(d, start);
  return Math.max(0, Math.min(100, (offset / total) * 100));
}

export function Timeline({
  rows,
  rangeStart,
  rangeEnd,
  showToday = true,
  rowHeight = 36,
  labelWidth = 180,
  emptyMessage = "Geen items om te tonen",
}: Props) {
  const start = new Date(rangeStart);
  const end = new Date(rangeEnd);
  const totalDays = Math.max(1, differenceInCalendarDays(end, start) + 1);
  const today = new Date();
  const todayWithinRange = today >= start && today <= end;

  const ticks: { date: Date; left: number }[] = [];
  const step = Math.max(1, Math.ceil(totalDays / 10));
  for (let i = 0; i <= totalDays; i += step) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    ticks.push({ date: d, left: pct(d, start, totalDays) });
  }

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">{emptyMessage}</p>;
  }

  return (
    <div className="border rounded-md overflow-hidden">
      <div className="flex bg-muted/40 border-b text-xs text-muted-foreground" style={{ height: 28 }}>
        <div className="shrink-0 border-r px-3 flex items-center" style={{ width: labelWidth }}>
          {format(start, "d MMM", { locale: nl })} – {format(end, "d MMM yyyy", { locale: nl })}
        </div>
        <div className="relative flex-1">
          {ticks.map((t, i) => (
            <div
              key={i}
              className="absolute top-0 bottom-0 border-l border-border/40 pl-1 text-[10px]"
              style={{ left: `${t.left}%` }}
            >
              {format(t.date, "d MMM", { locale: nl })}
            </div>
          ))}
        </div>
      </div>

      <div className="relative">
        {showToday && todayWithinRange && (
          <div
            className="absolute top-0 bottom-0 w-px bg-primary z-10 pointer-events-none"
            style={{ left: `calc(${labelWidth}px + ${pct(today, start, totalDays)}% * (100% - ${labelWidth}px) / 100)` }}
            title={`Vandaag: ${format(today, "d MMM yyyy", { locale: nl })}`}
          />
        )}
        {rows.map((row) => (
          <div key={row.id} className="flex border-b last:border-b-0" style={{ height: rowHeight }}>
            <div
              className="shrink-0 border-r px-3 flex items-center text-xs font-medium truncate"
              style={{ width: labelWidth }}
            >
              {row.label}
            </div>
            <div className="relative flex-1">
              {row.bars.map((bar) => {
                const barStart = new Date(bar.startDate);
                const barEnd = new Date(bar.endDate);
                const left = pct(barStart, start, totalDays);
                const right = pct(barEnd, start, totalDays);
                const width = Math.max(0.5, right - left);
                return (
                  <button
                    key={bar.id}
                    type="button"
                    onClick={bar.onClick}
                    className={cn(
                      "absolute top-1/2 -translate-y-1/2 h-6 rounded text-[10px] px-1.5 truncate text-left",
                      "border border-primary/40 bg-primary/20 hover:bg-primary/30 transition-colors",
                      bar.highlighted && "ring-2 ring-primary",
                      bar.onClick && "cursor-pointer",
                      bar.className
                    )}
                    style={{ left: `${left}%`, width: `${width}%` }}
                    title={typeof bar.label === "string" ? bar.label : undefined}
                  >
                    {bar.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
