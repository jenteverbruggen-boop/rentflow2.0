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

  // H1.3 — an already-assigned person stays in this list (disabled,
  // with an explanation) instead of being silently removed; the unique
  // constraint (one window per person per period) stays, so hiding
  // them made the API's own conflict() message unreachable.
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return (persons.data ?? []).filter((p) => {
      if (!q) return true;
      return (
        p.person.name.toLowerCase().includes(q) ||
        (p.person.functions ?? []).some((f) => f.function?.name.toLowerCase().includes(q))
      );
    });
  }, [persons.data, search]);

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

  // H2.1 — BookPersonDialog now owns the POST itself (it needs to retry
  // with allowOverlap after showing the user the conflict), so this
  // component only reacts once a booking actually succeeds.
  function handleBooked(warnings: string[]) {
    onWarnings(warnings);
    onError("");
    invalidate();
    setPendingAdd(null);
  }

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
            assignedIds={assignedIds}
            collapsed={collapsedLeft}
            onToggle={toggleLeft}
            onAdd={setPendingAdd}
          />
          <PersonAssignedPane
            periodId={period.id}
            periodName={period.name}
            hasAnyPeople={period.people.length > 0}
            assignedByRole={assignedByRole}
            collapsed={collapsedRight}
            onToggle={toggleRight}
            days={days}
            onRemove={(id) => remove.mutate(id)}
            invalidateKey={["project", String(project.id)]}
          />
        </div>
      </CardContent>
      <BookPersonDialog
        person={pendingAdd}
        periodId={period.id}
        clientId={project.clientId}
        onBooked={handleBooked}
        onClose={() => setPendingAdd(null)}
      />
    </Card>
  );
}
