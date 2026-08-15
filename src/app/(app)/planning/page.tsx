"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  format,
  eachDayOfInterval,
  startOfWeek,
  endOfWeek,
  addWeeks,
  subWeeks,
  startOfDay,
  endOfDay,
} from "date-fns";
import { nl } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { PlanningWeekGrid } from "@/components/planning-week-grid";
import { PlanningWeekList } from "@/components/planning-week-list";
import type { Project } from "@/types";

async function fetchProjects(): Promise<Project[]> {
  const res = await fetch("/api/projects");
  if (!res.ok) throw new Error("Ophalen mislukt");
  return res.json();
}

function countAssignments(project: Project) {
  let people = 0,
    materials = 0;
  for (const period of project.periods) {
    people += period.people.length;
    materials += period.materials.length;
  }
  return { people, materials };
}

export default function PlanningPage() {
  const [week, setWeek] = useState(new Date());
  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: fetchProjects,
    staleTime: 60_000,
  });

  const dayDates = eachDayOfInterval({
    start: startOfWeek(week, { weekStartsOn: 1 }),
    end: endOfWeek(week, { weekStartsOn: 1 }),
  });

  const projectsOnDay = (day: Date) =>
    projects.filter((p) => {
      const dayStart = startOfDay(day);
      const dayEnd = endOfDay(day);
      return new Date(p.startDate) <= dayEnd && new Date(p.endDate) >= dayStart;
    });

  const days = dayDates.map((date) => ({
    date,
    projects: projectsOnDay(date).map((project) => ({
      project,
      ...countAssignments(project),
    })),
  }));

  const weekProjects = [
    ...new Map(
      dayDates.flatMap(projectsOnDay).map((p) => [p.id, p]),
    ).values(),
  ].map((project) => ({ project, ...countAssignments(project) }));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Planning</h2>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setWeek(subWeeks(week, 1))}
          >
            ← Vorige
          </Button>
          <span className="text-sm text-muted-foreground min-w-40 text-center">
            {format(dayDates[0], "d MMM", { locale: nl })} –{" "}
            {format(dayDates[6], "d MMM yyyy", { locale: nl })}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setWeek(addWeeks(week, 1))}
          >
            Volgende →
          </Button>
          <Button size="sm" onClick={() => setWeek(new Date())}>
            Vandaag
          </Button>
        </div>
      </div>

      <PlanningWeekGrid days={days} />
      <PlanningWeekList weekProjects={weekProjects} />
    </div>
  );
}
