"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { format, startOfWeek, endOfWeek, eachDayOfInterval } from "date-fns";
import { nl } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { PlanningWeekGrid } from "@/components/planning-week-grid";
import { PlanningWeekList } from "@/components/planning-week-list";
import { PlanningMonthGrid } from "@/components/planning-month-grid";
import { PlanningDayTimeline } from "@/components/planning-day-timeline";
import { stepDate, monthGridDays, parseViewParam, parseDateParam, type PlanningView } from "@/lib/planning-dates";
import { projectsOnDay, countAssignments, projectsToDayPeriods } from "@/lib/planning-project-data";
import type { Project } from "@/types";

async function fetchProjects(): Promise<Project[]> {
  const res = await fetch("/api/projects");
  if (!res.ok) throw new Error("Ophalen mislukt");
  return res.json();
}

const VIEW_LABELS: Record<PlanningView, string> = { day: "Dag", week: "Week", month: "Maand" };

/** I1.1 — view + date live in the URL (`?view=&date=`), replacing the
 * old local `useState` cursor — reload-safe and shareable, following
 * the house `useSearchParams()`/`router.replace()` pattern
 * (projects/[id]/page.tsx). */
function PlanningPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const view = parseViewParam(searchParams.get("view"));
  const cursor = parseDateParam(searchParams.get("date"));

  const { data: projects = [] } = useQuery({ queryKey: ["projects"], queryFn: fetchProjects, staleTime: 60_000 });

  function setParams(nextView: PlanningView, nextDate: Date) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", nextView);
    params.set("date", format(nextDate, "yyyy-MM-dd"));
    router.replace(`?${params.toString()}`);
  }

  const weekDates = eachDayOfInterval({
    start: startOfWeek(cursor, { weekStartsOn: 1 }),
    end: endOfWeek(cursor, { weekStartsOn: 1 }),
  });
  const weekDays = weekDates.map((date) => ({
    date,
    projects: projectsOnDay(projects, date).map((project) => ({ project, ...countAssignments(project) })),
  }));
  const weekProjects = [...new Map(weekDates.flatMap((d) => projectsOnDay(projects, d)).map((p) => [p.id, p])).values()]
    .map((project) => ({ project, ...countAssignments(project) }));
  const monthDays = monthGridDays(cursor).map((date) => ({ date, projects: projectsOnDay(projects, date) }));
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
            {(Object.keys(VIEW_LABELS) as PlanningView[]).map((v) => (
              <Button key={v} size="sm" variant={view === v ? "default" : "outline"} onClick={() => setParams(v, cursor)}>
                {VIEW_LABELS[v]}
              </Button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={() => setParams(view, stepDate(view, cursor, -1))}>← Vorige</Button>
          <span className="text-sm text-muted-foreground min-w-40 text-center capitalize">{rangeLabel}</span>
          <Button variant="outline" size="sm" onClick={() => setParams(view, stepDate(view, cursor, 1))}>Volgende →</Button>
          <Button size="sm" onClick={() => setParams(view, new Date())}>Vandaag</Button>
        </div>
      </div>

      {view === "week" && (
        <>
          <PlanningWeekGrid days={weekDays} />
          <PlanningWeekList weekProjects={weekProjects} />
        </>
      )}
      {view === "month" && <PlanningMonthGrid month={cursor} days={monthDays} />}
      {view === "day" && <PlanningDayTimeline day={cursor} periods={dayPeriods} />}
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
