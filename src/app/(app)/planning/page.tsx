"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { format, startOfWeek, endOfWeek, eachDayOfInterval, startOfDay, endOfDay } from "date-fns";
import { nl } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { PlanningWeekGrid } from "@/components/planning-week-grid";
import { PlanningWeekList } from "@/components/planning-week-list";
import { PlanningMonthGrid } from "@/components/planning-month-grid";
import { PlanningDayTimeline } from "@/components/planning-day-timeline";
import { PlanningPersonView } from "@/components/planning-person-view";
import {
  stepDate,
  monthGridDays,
  parseViewParam,
  parseDateParam,
  parseModeParam,
  type PlanningView,
} from "@/lib/planning-dates";
import { periodsOnDay, projectTotals, projectsToDayPeriods } from "@/lib/planning-project-data";
import { usePlanningProjects } from "@/hooks/use-planning-projects";
import { usePlanningPersonRows } from "@/hooks/use-planning-person-rows";

const VIEW_LABELS: Record<PlanningView, string> = { day: "Dag", week: "Week", month: "Maand" };

/**
 * I1.1/I2.2 — view + date live in the URL; the visible range is
 * range-fetched from the lean planning endpoint (I2.1) and bucketed by
 * **period**, not whole projects (I2.2) — a Mon–Fri project with a
 * single Wednesday period no longer paints Mon/Tue/Thu/Fri.
 */
function PlanningPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const view = parseViewParam(searchParams.get("view"));
  const cursor = parseDateParam(searchParams.get("date"));
  const mode = parseModeParam(searchParams.get("mode"));

  const weekDates = eachDayOfInterval({
    start: startOfWeek(cursor, { weekStartsOn: 1 }),
    end: endOfWeek(cursor, { weekStartsOn: 1 }),
  });
  const monthDates = monthGridDays(cursor);
  const rangeStart =
    view === "day" ? startOfDay(cursor) : view === "month" ? monthDates[0] : weekDates[0];
  const rangeEnd =
    view === "day" ? endOfDay(cursor) : view === "month" ? monthDates[monthDates.length - 1] : weekDates[6];

  const { data: projects = [] } = usePlanningProjects(rangeStart, rangeEnd);
  const { data: personRows = [] } = usePlanningPersonRows(rangeStart, rangeEnd, mode === "person");

  function setParams(next: { view?: PlanningView; date?: Date; mode?: "project" | "person" }) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", next.view ?? view);
    params.set("date", format(next.date ?? cursor, "yyyy-MM-dd"));
    params.set("mode", next.mode ?? mode);
    router.replace(`?${params.toString()}`);
  }

  const weekDays = weekDates.map((date) => ({ date, periods: periodsOnDay(projects, date) }));
  const weekProjects = projectTotals(weekDates.flatMap((d) => periodsOnDay(projects, d)));
  const monthDays = monthDates.map((date) => ({ date, periods: periodsOnDay(projects, date) }));
  const dayPeriods = projectsToDayPeriods(projects);

  const rangeLabel =
    view === "day"
      ? format(cursor, "EEEE d MMMM yyyy", { locale: nl })
      : view === "month"
        ? format(cursor, "MMMM yyyy", { locale: nl })
        : `${format(weekDates[0], "d MMM", { locale: nl })} – ${format(weekDates[6], "d MMM yyyy", { locale: nl })}`;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <h2 className="text-2xl font-bold">Planning</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1">
            <Button size="sm" variant={mode === "project" ? "default" : "outline"} onClick={() => setParams({ mode: "project" })}>
              Projecten
            </Button>
            <Button size="sm" variant={mode === "person" ? "default" : "outline"} onClick={() => setParams({ mode: "person" })}>
              Personen
            </Button>
          </div>
          {mode === "project" && (
            <div className="flex gap-1">
              {(Object.keys(VIEW_LABELS) as PlanningView[]).map((v) => (
                <Button key={v} size="sm" variant={view === v ? "default" : "outline"} onClick={() => setParams({ view: v })}>
                  {VIEW_LABELS[v]}
                </Button>
              ))}
            </div>
          )}
          <Button variant="outline" size="sm" onClick={() => setParams({ date: stepDate(view, cursor, -1) })}>← Vorige</Button>
          <span className="text-sm text-muted-foreground min-w-40 text-center capitalize">{rangeLabel}</span>
          <Button variant="outline" size="sm" onClick={() => setParams({ date: stepDate(view, cursor, 1) })}>Volgende →</Button>
          <Button size="sm" onClick={() => setParams({ date: new Date() })}>Vandaag</Button>
        </div>
      </div>

      {mode === "person" ? (
        <PlanningPersonView rows={personRows} />
      ) : (
        <>
          {view === "week" && (
            <>
              <PlanningWeekGrid days={weekDays} />
              <PlanningWeekList weekProjects={weekProjects} />
            </>
          )}
          {view === "month" && <PlanningMonthGrid month={cursor} days={monthDays} />}
          {view === "day" && <PlanningDayTimeline day={cursor} periods={dayPeriods} />}
        </>
      )}
    </div>
  );
}

export default function PlanningPage() {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Laden...</p>}>
      <PlanningPageContent />
    </Suspense>
  );
}
