"use client";

import Link from "next/link";
import { computeDayBlocks, type DayBlockPeriod } from "@/lib/planning-day-blocks";
import { cn, statusVariant } from "@/lib/utils";

interface Props {
  day: Date;
  periods: DayBlockPeriod[];
}

const HOURS = Array.from({ length: 17 }, (_, i) => 8 + i); // 08:00..24:00

/** I1.3 — the payoff surface for H1's per-assignment hours: an
 * 08:00–24:00 axis with blocks positioned and sized by actual
 * booking times, rather than the week/month views' whole-day
 * placement. Clamped blocks (starting before 08:00 or ending after
 * midnight) show a ⚠ indicator instead of being silently hidden. */
export function PlanningDayTimeline({ day, periods }: Props) {
  const blocks = computeDayBlocks(day, periods);

  return (
    <div className="flex border rounded-lg bg-card overflow-hidden">
      <div className="w-14 shrink-0 border-r text-xs text-muted-foreground">
        {HOURS.map((h) => (
          <div key={h} className="h-16 border-b last:border-0 pr-2 text-right pt-0.5">
            {String(h % 24).padStart(2, "0")}:00
          </div>
        ))}
      </div>
      <div className="relative flex-1" style={{ height: `${HOURS.length * 4}rem` }}>
        {HOURS.map((h) => (
          <div key={h} className="absolute left-0 right-0 border-b" style={{ top: `${((h - 8) / 16) * 100}%` }} />
        ))}
        {blocks.length === 0 && (
          <p className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
            Geen periodes op deze dag
          </p>
        )}
        {blocks.map((b) => (
          <Link
            key={b.key}
            href={`/projects/${b.projectId}`}
            className={cn(
              "absolute left-1 right-1 rounded px-2 py-0.5 text-xs overflow-hidden focus-visible:ring-2 focus-visible:ring-ring",
              statusVariant(b.status),
            )}
            style={{ top: `${b.topPct}%`, height: `${b.heightPct}%` }}
          >
            <span className="font-medium truncate block">
              {(b.clampedStart || b.clampedEnd) && "⚠ "}
              {b.projectName}
            </span>
            <span className="opacity-70">{b.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
