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
  isSameDay,
} from "date-fns";
import { nl } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn, statusVariant } from "@/lib/utils";
import type { Project } from "@/types";

async function fetchProjects(): Promise<Project[]> {
  const res = await fetch("/api/projects");
  if (!res.ok) throw new Error("Ophalen mislukt");
  return res.json();
}

export default function PlanningPage() {
  const [week, setWeek] = useState(new Date());
  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: fetchProjects,
    staleTime: 60_000,
  });

  const days = eachDayOfInterval({
    start: startOfWeek(week, { weekStartsOn: 1 }),
    end: endOfWeek(week, { weekStartsOn: 1 }),
  });

  const projectsOnDay = (day: Date) =>
    projects.filter((p) => new Date(p.startDate) <= day && new Date(p.endDate) >= day);

  const weekProjects = [...new Map(days.flatMap(projectsOnDay).map((p) => [p.id, p])).values()];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Planning</h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setWeek(subWeeks(week, 1))}>← Vorige</Button>
          <span className="text-sm text-muted-foreground min-w-40 text-center">
            {format(days[0], "d MMM", { locale: nl })} – {format(days[6], "d MMM yyyy", { locale: nl })}
          </span>
          <Button variant="outline" size="sm" onClick={() => setWeek(addWeeks(week, 1))}>Volgende →</Button>
          <Button size="sm" onClick={() => setWeek(new Date())}>Vandaag</Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {days.map((day) => {
          const dayProjects = projectsOnDay(day);
          const isToday = isSameDay(day, new Date());

          return (
            <Card
              key={day.toISOString()}
              className={cn("min-h-32", isToday && "border-primary")}
            >
              <CardContent className="p-3">
                <p className={cn("text-xs font-semibold mb-2", isToday ? "text-primary" : "text-muted-foreground")}>
                  {format(day, "EEE d", { locale: nl })}
                </p>
                <div className="space-y-1">
                  {dayProjects.map((p) => (
                    <div
                      key={p.id}
                      className={cn("rounded px-2 py-1", statusVariant(p.status))}
                      title={`${p.name} · ${p.people.length} personen · ${p.materials.length} materialen`}
                    >
                      <p className="text-xs font-medium truncate">{p.name}</p>
                      {p.location && <p className="text-xs opacity-70 truncate">{p.location}</p>}
                      <div className="flex gap-2 mt-0.5">
                        {p.people.length > 0 && <span className="text-xs opacity-70">👥 {p.people.length}</span>}
                        {p.materials.length > 0 && <span className="text-xs opacity-70">📦 {p.materials.length}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base text-muted-foreground">Alle projecten deze week</CardTitle>
        </CardHeader>
        <CardContent>
          {weekProjects.length === 0 ? (
            <p className="text-muted-foreground text-sm">Geen projecten deze week</p>
          ) : (
            <div className="space-y-0">
              {weekProjects.map((p, i) => (
                <div key={p.id}>
                  <div className="flex justify-between items-center py-3">
                    <div>
                      <p className="text-sm font-medium">{p.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {[p.client, p.location].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <div className="text-xs text-muted-foreground text-right">
                      <p>👥 {p.people.length} personen</p>
                      <p>📦 {p.materials.length} materialen</p>
                    </div>
                  </div>
                  {i < weekProjects.length - 1 && <Separator />}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
