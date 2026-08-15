"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Clock } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { DateInput } from "@/components/date-input";

interface Props {
  periodId: number;
  assignmentId: number;
  startAt: string | null;
  endAt: string | null;
  invalidateKey: readonly unknown[];
}

function toDateTimeLocal(iso: string): string {
  return format(new Date(iso), "yyyy-MM-dd'T'HH:mm");
}

/** H1.3 — optional "eigen uren" on a person's assignment: null means
 * "the whole period" (the default, and the only option before this
 * item). Send full ISO strings with an offset — never `.slice(0, 10)`,
 * never a bare `yyyy-MM-ddTHH:mm` — the Time rule this codebase applies
 * to every datetime field (H3/H4, phase 0). Round-trips through the
 * browser's own local timezone exactly like period-form.tsx already
 * does for period dates — not verified against a live Postgres server
 * in this environment (none available), stated explicitly rather than
 * assumed correct. */
export function AssignmentHoursPopover({ periodId, assignmentId, startAt, endAt, invalidateKey }: Props) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState(startAt ? toDateTimeLocal(startAt) : "");
  const [end, setEnd] = useState(endAt ? toDateTimeLocal(endAt) : "");
  const [error, setError] = useState("");

  const save = useMutation({
    mutationFn: async (body: { startAt: string | null; endAt: string | null }) => {
      const res = await fetch(`/api/periods/${periodId}/people/${assignmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Opslaan mislukt");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invalidateKey });
      setError("");
      setOpen(false);
    },
    onError: (err) => setError((err as Error).message),
  });

  function submit() {
    if (!start || !end) {
      save.mutate({ startAt: null, endAt: null });
      return;
    }
    save.mutate({
      startAt: new Date(start).toISOString(),
      endAt: new Date(end).toISOString(),
    });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          title={startAt && endAt ? "Eigen uren ingesteld" : "Eigen uren instellen"}
        >
          <Clock className={startAt && endAt ? "h-3.5 w-3.5 text-primary" : "h-3.5 w-3.5"} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 space-y-3">
        <p className="text-xs text-muted-foreground">
          Leeg laten = hele periode. Anders moeten beide velden binnen de periode vallen.
        </p>
        <div className="space-y-1.5">
          <Label className="text-xs">Van</Label>
          <DateInput type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Tot</Label>
          <DateInput type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <Button size="sm" className="w-full" disabled={save.isPending} onClick={submit}>
          {save.isPending ? "Bezig..." : "Opslaan"}
        </Button>
      </PopoverContent>
    </Popover>
  );
}
