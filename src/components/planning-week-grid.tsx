import { format, isSameDay } from "date-fns";
import { nl } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { PlanningCalendarItem } from "@/components/planning-calendar-item";
import type { Project } from "@/types";

export interface DayCell {
  date: Date;
  projects: { project: Project; people: number; materials: number }[];
}

interface Props {
  days: DayCell[];
}

/** The 7-column week grid, extracted from planning/page.tsx (Y3.2) — pure
 * move, no behaviour change. Receives already-computed per-day project
 * counts rather than recomputing countAssignments/projectsOnDay itself. */
export function PlanningWeekGrid({ days }: Props) {
  return (
    <div className="grid grid-cols-7 gap-2">
      {days.map(({ date, projects }) => {
        const isToday = isSameDay(date, new Date());
        return (
          <Card
            key={date.toISOString()}
            className={cn("min-h-32", isToday && "border-primary")}
          >
            <CardContent className="p-3">
              <p
                className={cn(
                  "text-xs font-semibold mb-2",
                  isToday ? "text-primary" : "text-muted-foreground",
                )}
              >
                {format(date, "EEE d", { locale: nl })}
              </p>
              <div className="space-y-1">
                {projects.map(({ project, people, materials }) => (
                  <PlanningCalendarItem
                    key={project.id}
                    project={project}
                    people={people}
                    materials={materials}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
