"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { usePersonAvailability } from "@/hooks/use-availability";
import { periodDays } from "@/lib/pricing";
import { groupAvailableByRole, groupAssignedByRole } from "@/lib/person-grouping";
import { PersonAvailablePane } from "@/components/person-available-pane";
import { PersonAssignedPane } from "@/components/person-assigned-pane";
import { BookPersonDialog } from "@/components/book-person-dialog";
import type { Period, Project, PersonAvailability } from "@/types";

interface Props {
  period: Period;
  project: Project;
  onWarnings: (warnings: string[]) => void;
  onError: (error: string) => void;
}

export function PersonSplitEditor({ period, project, onWarnings, onError }: Props) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [collapsedLeft, setCollapsedLeft] = useState<Set<string>>(new Set());
  const [collapsedRight, setCollapsedRight] = useState<Set<string>>(new Set());
  const [pendingAdd, setPendingAdd] = useState<PersonAvailability | null>(null);

  // Full ISO timestamps (with offset) — do not truncate to date-only with
  // .slice(0, 10). A date-only string parses as UTC midnight, so a
  // single-day period's from === to produced a zero-width overlap window
  // and everyone showed "Beschikbaar" regardless of actual bookings (H3).
  const range = {
    from: period.startDate,
    to: period.endDate,
    excludePeriodId: period.id,
    sameProjectId: project.id,
    projectId: project.id,
  };
  const persons = usePersonAvailability(range);
  const days = periodDays(period);
  const assignedIds = useMemo(
    () => new Set(period.people.map((pp) => pp.personId)),
    [period.people],
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return (persons.data ?? []).filter((p) => {
      if (assignedIds.has(p.person.id)) return false;
      if (!q) return true;
      return (
        p.person.name.toLowerCase().includes(q) ||
        (p.person.role ?? "").toLowerCase().includes(q)
      );
    });
  }, [persons.data, search, assignedIds]);

  const byRole = useMemo(() => groupAvailableByRole(filtered), [filtered]);

  const toggle = (side: "L" | "R") => (role: string) => {
    const setter = side === "L" ? setCollapsedLeft : setCollapsedRight;
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(role)) next.delete(role);
      else next.add(role);
      return next;
    });
  };
  const toggleLeft = toggle("L");
  const toggleRight = toggle("R");

  const assignedByRole = useMemo(
    () => groupAssignedByRole(period.people),
    [period],
  );

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["project", String(project.id)] });
    queryClient.invalidateQueries({ queryKey: ["available"] });
  };

  const add = useMutation({
    mutationFn: async (args: { personId: number; role?: string; functionId: number | null }) => {
      const res = await fetch(`/api/periods/${period.id}/people`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(args),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Toevoegen mislukt");
      return data as { warnings: string[] };
    },
    onSuccess: (data) => {
      onWarnings(data.warnings ?? []);
      onError("");
      invalidate();
      setPendingAdd(null);
    },
    onError: (err) => onError((err as Error).message),
  });

  const remove = useMutation({
    mutationFn: (assignmentId: number) =>
      fetch(`/api/periods/${period.id}/people/${assignmentId}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });

  return (
    <Card>
      <CardContent className="pt-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <PersonAvailablePane
            search={search}
            onSearchChange={setSearch}
            byRole={byRole}
            collapsed={collapsedLeft}
            onToggle={toggleLeft}
            onAdd={setPendingAdd}
            addPending={add.isPending}
          />
          <PersonAssignedPane
            periodName={period.name}
            hasAnyPeople={period.people.length > 0}
            assignedByRole={assignedByRole}
            collapsed={collapsedRight}
            onToggle={toggleRight}
            days={days}
            onRemove={(id) => remove.mutate(id)}
          />
        </div>
      </CardContent>
      <BookPersonDialog
        person={pendingAdd}
        periodId={period.id}
        clientId={project.clientId}
        onConfirm={(args) => add.mutate(args)}
        onClose={() => setPendingAdd(null)}
        isPending={add.isPending}
      />
    </Card>
  );
}
