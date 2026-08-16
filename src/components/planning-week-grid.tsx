import { format, isSameDay } from "date-fns";
import { nl } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { PlanningPeriodItem } from "@/components/planning-period-item";
import type { PeriodWithProject } from "@/lib/planning-project-data";

export interface DayCell {
  date: Date;
  periods: PeriodWithProject[];
}

interface Props {
  days: DayCell[];
}

/** I2.2 — the 7-column week grid now places **periods**, not whole
 * projects: a Mon–Fri project with a single Wednesday period only
 * paints Wednesday. */
export function PlanningWeekGrid({ days }: Props) {
  return (
    <div className="grid grid-cols-7 gap-2">
      {days.map(({ date, periods }) => {
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
                {periods.map(({ period, project }) => (
                  <PlanningPeriodItem key={period.id} period={period} project={project} />
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
