"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Timeline, type TimelineRow } from "@/components/timeline";
import type { Project } from "@/types";

interface Props {
  project: Project;
  selectedPeriodId: number | null;
  onSelectPeriod: (id: number) => void;
}

export function PeriodTimelinePicker({ project, selectedPeriodId, onSelectPeriod }: Props) {
  const rows: TimelineRow[] = project.periods.map((p) => ({
    id: p.id,
    label: p.name,
    bars: [
      {
        id: p.id,
        startDate: p.startDate,
        endDate: p.endDate,
        label: p.name,
        highlighted: p.id === selectedPeriodId,
        onClick: () => onSelectPeriod(p.id),
      },
    ],
  }));

  const rangeStart = project.periods.reduce(
    (min, p) => (new Date(p.startDate) < min ? new Date(p.startDate) : min),
    new Date(project.startDate)
  );
  const rangeEnd = project.periods.reduce(
    (max, p) => (new Date(p.endDate) > max ? new Date(p.endDate) : max),
    new Date(project.endDate)
  );

  return (
    <Card>
      <CardContent className="pt-5">
        <h3 className="text-sm font-semibold mb-3">Periode kiezen</h3>
        <Timeline rows={rows} rangeStart={rangeStart} rangeEnd={rangeEnd} emptyMessage="Nog geen periodes" />
      </CardContent>
    </Card>
  );
}
