"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { PeriodList } from "@/components/period-list";
import { PeriodForm } from "@/components/period-form";
import { PeriodBookings } from "@/components/period-bookings";
import { Timeline, type TimelineRow } from "@/components/timeline";
import type { Period, Project } from "@/types";

interface Props {
  project: Project;
  selectedPeriodId: number | null;
  onSelectPeriod: (id: number) => void;
}

export function ProjectPeriodsTab({ project, selectedPeriodId, onSelectPeriod }: Props) {
  const queryClient = useQueryClient();
  const [periodFormOpen, setPeriodFormOpen] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState<Period | null>(null);

  const projectKey = ["project", String(project.id)] as const;
  const invalidate = () => queryClient.invalidateQueries({ queryKey: projectKey });

  const upsertPeriod = useMutation({
    mutationFn: async (values: { name: string; startDate: string; endDate: string }) => {
      const url = editingPeriod
        ? `/api/periods/${editingPeriod.id}`
        : `/api/projects/${project.id}/periods`;
      const res = await fetch(url, {
        method: editingPeriod ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Opslaan mislukt");
      return data;
    },
    onSuccess: (data) => {
      setPeriodFormOpen(false);
      setEditingPeriod(null);
      if (!editingPeriod && data?.id) onSelectPeriod(data.id);
      invalidate();
    },
  });

  const deletePeriod = useMutation({
    mutationFn: (periodId: number) => fetch(`/api/periods/${periodId}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });

  const selectedPeriod = project.periods.find((p) => p.id === selectedPeriodId) ?? null;

  const rangeStart = project.periods.reduce(
    (min, p) => (new Date(p.startDate) < min ? new Date(p.startDate) : min),
    new Date(project.startDate)
  );
  const rangeEnd = project.periods.reduce(
    (max, p) => (new Date(p.endDate) > max ? new Date(p.endDate) : max),
    new Date(project.endDate)
  );

  const timelineRows: TimelineRow[] = project.periods.map((p) => ({
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

  return (
    <div className="space-y-4">
      <Timeline rows={timelineRows} rangeStart={rangeStart} rangeEnd={rangeEnd} emptyMessage="Nog geen periodes" />

      <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-4">
        <PeriodList
          periods={project.periods}
          selectedId={selectedPeriodId}
          onSelect={onSelectPeriod}
          onAdd={() => { setEditingPeriod(null); setPeriodFormOpen(true); }}
          onEdit={(p) => { setEditingPeriod(p); setPeriodFormOpen(true); }}
          onDelete={(p) => {
            if (confirm(`Periode "${p.name}" verwijderen? Bijbehorende boekingen verdwijnen ook.`)) {
              deletePeriod.mutate(p.id);
            }
          }}
          project={project}
        />

        {selectedPeriod ? (
          <div className="min-w-0">
            <PeriodBookings period={selectedPeriod} project={project} />
            <p className="text-xs text-muted-foreground mt-3">
              Gebruik de tabs <strong>Personen</strong> of <strong>Materialen</strong> om aan deze periode toe te voegen.
            </p>
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground text-sm">
              Selecteer een periode om boekingen te bekijken
            </CardContent>
          </Card>
        )}
      </div>

      <PeriodForm
        open={periodFormOpen}
        onOpenChange={setPeriodFormOpen}
        defaultValues={editingPeriod}
        project={project}
        onSubmit={(v) => upsertPeriod.mutate(v)}
        isPending={upsertPeriod.isPending}
      />
    </div>
  );
}
