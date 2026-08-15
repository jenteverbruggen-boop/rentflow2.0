"use client";

import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { useMaterialAvailability } from "@/hooks/use-availability";
import { useMaterialSplitMutations } from "@/hooks/use-material-split-mutations";
import { periodDays } from "@/lib/pricing";
import { groupMaterialAssignments, type MaterialGroup } from "@/lib/grouping";
import {
  groupAvailableByCategory,
  groupAssignedByCategory,
} from "@/lib/material-grouping";
import { MaterialAvailablePane } from "@/components/material-available-pane";
import { MaterialAssignedPane } from "@/components/material-assigned-pane";
import type { Period, Project } from "@/types";

interface Props {
  period: Period;
  project: Project;
  onWarnings: (warnings: string[]) => void;
  onError: (error: string) => void;
}

export function MaterialSplitEditor({
  period,
  project,
  onWarnings,
  onError,
}: Props) {
  const [search, setSearch] = useState("");
  const [collapsedLeft, setCollapsedLeft] = useState<Set<string>>(new Set());
  const [collapsedRight, setCollapsedRight] = useState<Set<string>>(new Set());
  const [qtyMap, setQtyMap] = useState<Record<number, number>>({});

  // Full ISO timestamps (with offset) — do not truncate to date-only with
  // .slice(0, 10). A date-only string parses as UTC midnight, so a
  // single-day period's from === to produced a zero-width overlap window
  // and everyone showed "available" regardless of actual bookings (H3).
  const range = {
    from: period.startDate,
    to: period.endDate,
    sameProjectId: project.id,
    projectId: project.id,
  };
  const mats = useMaterialAvailability(range);
  const days = periodDays(period);
  const groups = groupMaterialAssignments(period.materials);

  const { add, removeOne, removeBundle } = useMaterialSplitMutations({
    periodId: period.id,
    projectId: project.id,
    onWarnings,
    onError,
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return (mats.data ?? []).filter((m) => {
      if (m.availableCount === 0) return false;
      if (!q) return true;
      return (
        m.material.name.toLowerCase().includes(q) ||
        (m.material.category ?? "").toLowerCase().includes(q)
      );
    });
  }, [mats.data, search]);

  const byCategory = useMemo(
    () => groupAvailableByCategory(filtered),
    [filtered],
  );

  const toggle = (side: "L" | "R") => (cat: string) => {
    const setter = side === "L" ? setCollapsedLeft : setCollapsedRight;
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };
  const toggleLeft = toggle("L");
  const toggleRight = toggle("R");

  const groupsByCategory = useMemo(
    () => groupAssignedByCategory(groups),
    [groups],
  );

  function removeAllInGroup(group: MaterialGroup) {
    for (const a of group.assignments) removeOne.mutate(a.id);
  }

  return (
    <Card>
      <CardContent className="pt-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <MaterialAvailablePane
            search={search}
            onSearchChange={setSearch}
            byCategory={byCategory}
            collapsed={collapsedLeft}
            onToggle={toggleLeft}
            qtyMap={qtyMap}
            onQtyChange={(materialId, qty) =>
              setQtyMap((q) => ({ ...q, [materialId]: qty }))
            }
            onAdd={(args) => add.mutate(args)}
            addPending={add.isPending}
          />
          <MaterialAssignedPane
            periodName={period.name}
            groupsByCategory={groupsByCategory}
            hasAnyBookings={
              groups.length > 0 || (period.bundleBookings ?? []).length > 0
            }
            collapsed={collapsedRight}
            onToggle={toggleRight}
            days={days}
            onRemoveOne={(id) => removeOne.mutate(id)}
            onRemoveAllInGroup={removeAllInGroup}
            bundleBookings={period.bundleBookings ?? []}
            onRemoveBundle={(id) => removeBundle.mutate(id)}
          />
        </div>
      </CardContent>
    </Card>
  );
}
