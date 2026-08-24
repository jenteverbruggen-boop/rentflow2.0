"use client";

import { useEffect, useState } from "react";
import { getDay } from "date-fns";
import { CalendarClock } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AssignmentDayRow } from "@/components/assignment-day-row";
import {
  buildDayOptions,
  selectedWindows,
  type DayOption,
} from "@/lib/assignment-day-options";
import type { AssignmentDay } from "@/types";

interface Props {
  periodId: number;
  assignmentId: number;
  period: { startDate: string; endDate: string };
  days: AssignmentDay[] | undefined;
  invalidateKey: readonly unknown[];
}

/**
 * H6 — which days of the period this person actually works. The default
 * is still the whole period (no day rows at all, exactly as before this
 * item); ticking days narrows both the planning and the billing to those
 * days, with per-day hours for the cases where a day is a half day.
 *
 * Times round-trip through the browser's own local timezone, like the
 * single-window popover this replaces — never a bare `yyyy-MM-dd`, which
 * would read as UTC midnight and shift the day.
 */
export function AssignmentDaysPopover({ periodId, assignmentId, period, days, invalidateKey }: Props) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<DayOption[]>([]);
  const [error, setError] = useState("");

  // Re-seed from the server's own state every time the popover opens, so
  // an abandoned edit never lingers as a phantom selection. Keyed on
  // `open` alone on purpose: `days` is a fresh array on every refetch, so
  // including it would wipe the user's ticks mid-edit whenever the project
  // query refetches (window focus, another mutation).
  useEffect(() => {
    if (open) {
      setOptions(buildDayOptions(period, days));
      setError("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const save = useMutation({
    mutationFn: async (windows: { startAt: string; endAt: string }[]) => {
      const res = await fetch(`/api/periods/${periodId}/people/${assignmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days: windows }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? `Opslaan mislukt (${res.status})`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invalidateKey });
      queryClient.invalidateQueries({ queryKey: ["available"] });
      setError("");
      setOpen(false);
    },
    onError: (err: Error) => setError(err.message),
  });

  function update(key: string, next: Partial<DayOption>) {
    setOptions((prev) => prev.map((o) => (o.key === key ? { ...o, ...next } : o)));
  }

  function selectAll(predicate: (option: DayOption) => boolean) {
    setOptions((prev) => prev.map((o) => ({ ...o, selected: predicate(o) })));
  }

  const isWeekday = (option: DayOption) => {
    const day = getDay(new Date(`${option.key}T12:00`));
    return day >= 1 && day <= 5;
  };
  const hasSelection = (days ?? []).length > 0;
  const selectedCount = options.filter((o) => o.selected).length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          title={hasSelection ? "Specifieke dagen ingesteld" : "Dagen en uren kiezen"}
        >
          <CalendarClock className={hasSelection ? "h-3.5 w-3.5 text-primary" : "h-3.5 w-3.5"} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 max-w-[calc(100vw-2rem)] space-y-3">
        <div className="space-y-1">
          <p className="text-sm font-medium">Dagen</p>
          <p className="text-xs text-muted-foreground">
            Niets aanvinken = de hele periode. Aangevinkte dagen worden gepland én gefactureerd.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" variant="secondary" className="h-7 px-2 text-xs" onClick={() => selectAll(() => true)}>
            Alle dagen
          </Button>
          <Button size="sm" variant="secondary" className="h-7 px-2 text-xs" onClick={() => selectAll(isWeekday)}>
            Werkdagen
          </Button>
          <Button size="sm" variant="secondary" className="h-7 px-2 text-xs" onClick={() => selectAll(() => false)}>
            Wissen
          </Button>
        </div>
        <ScrollArea className="h-56 pr-2">
          <div className="space-y-0.5">
            {options.map((option) => (
              <AssignmentDayRow key={option.key} option={option} onChange={(next) => update(option.key, next)} />
            ))}
          </div>
        </ScrollArea>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">
            {selectedCount === 0 ? "Hele periode" : `${selectedCount} dag(en)`}
          </span>
          <Button
            size="sm"
            disabled={save.isPending}
            onClick={() => save.mutate(selectedWindows(options))}
          >
            {save.isPending ? "Bezig..." : "Opslaan"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
