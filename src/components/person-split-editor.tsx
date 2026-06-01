"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, ChevronDown, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { usePersonAvailability } from "@/hooks/use-availability";
import { formatEUR, periodDays, personLineCost } from "@/lib/pricing";
import type { Period, PersonAvailability, Project } from "@/types";

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

  const range = {
    from: period.startDate.slice(0, 10),
    to: period.endDate.slice(0, 10),
    excludePeriodId: period.id,
    sameProjectId: project.id,
    projectId: project.id,
  };
  const persons = usePersonAvailability(range);
  const days = periodDays(period);
  const assignedIds = new Set(period.people.map((pp) => pp.personId));

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

  const byRole = useMemo(() => {
    const map = new Map<string, PersonAvailability[]>();
    for (const p of filtered) {
      const role = p.person.role ?? "Overig";
      if (!map.has(role)) map.set(role, []);
      map.get(role)!.push(p);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

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

  const assignedByRole = useMemo(() => {
    const map = new Map<string, typeof period.people>();
    for (const pp of period.people) {
      const role = pp.role ?? pp.person.role ?? "Overig";
      if (!map.has(role)) map.set(role, []);
      map.get(role)!.push(pp);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [period.people]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["project", String(project.id)] });
    queryClient.invalidateQueries({ queryKey: ["available"] });
  };

  const add = useMutation({
    mutationFn: async (args: { personId: number; role?: string }) => {
      const res = await fetch(`/api/periods/${period.id}/people`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(args),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Toevoegen mislukt");
      return data as { warnings: string[] };
    },
    onSuccess: (data) => { onWarnings(data.warnings ?? []); onError(""); invalidate(); },
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
        <div className="grid grid-cols-2 gap-4">
          <section className="space-y-2">
            <h4 className="text-xs font-semibold uppercase text-muted-foreground">Beschikbaar</h4>
            <Input placeholder="Zoeken op naam of functie..." value={search} onChange={(e) => setSearch(e.target.value)} />
            <ScrollArea className="h-[440px] pr-2">
              <div className="space-y-2">
                {byRole.map(([role, items]) => {
                  const isCollapsed = collapsedLeft.has(role);
                  return (
                    <div key={role}>
                      <button
                        type="button"
                        className="flex items-center gap-1 text-xs font-semibold uppercase text-muted-foreground w-full hover:text-foreground"
                        onClick={() => toggleLeft(role)}
                      >
                        {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        <span>{role}</span>
                        <span className="font-normal normal-case ml-1">({items.length})</span>
                      </button>
                      {!isCollapsed && (
                        <div className="space-y-1 mt-1 ml-4">
                          {items.map((p) => (
                            <div key={p.person.id} className="flex items-center gap-1.5 bg-muted/30 rounded px-2 py-1 text-xs">
                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">{p.person.name}</p>
                                <p className="text-[10px] text-muted-foreground">
                                  {p.isAvailable ? "Beschikbaar" : `Bezet (${p.blockingProject?.name})`} · {formatEUR(p.person.dayPrice)}/d
                                </p>
                              </div>
                              <Button
                                size="icon"
                                className="h-7 w-7"
                                disabled={!p.isAvailable || add.isPending}
                                onClick={() => add.mutate({ personId: p.person.id, role: p.person.role ?? undefined })}
                                title="Toevoegen aan periode"
                              >
                                <ArrowRight className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
                {byRole.length === 0 && (
                  <p className="text-xs text-muted-foreground py-6 text-center">Geen personen beschikbaar</p>
                )}
              </div>
            </ScrollArea>
          </section>

          <section className="space-y-2">
            <h4 className="text-xs font-semibold uppercase text-muted-foreground">In "{period.name}"</h4>
            <div className="h-9" aria-hidden />
            <ScrollArea className="h-[440px] pr-2">
              <div className="space-y-2">
                {assignedByRole.map(([role, items]) => {
                  const isCollapsed = collapsedRight.has(role);
                  return (
                    <div key={role}>
                      <button
                        type="button"
                        className="flex items-center gap-1 text-xs font-semibold uppercase text-muted-foreground w-full hover:text-foreground"
                        onClick={() => toggleRight(role)}
                      >
                        {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        <span>{role}</span>
                        <span className="font-normal normal-case ml-1">({items.length})</span>
                      </button>
                      {!isCollapsed && (
                        <div className="space-y-1 mt-1 ml-4">
                          {items.map((pp) => (
                            <div key={pp.id} className="flex items-center gap-1.5 bg-muted/40 rounded px-2 py-1 text-xs">
                              <Button
                                size="icon"
                                variant="outline"
                                className="h-7 w-7"
                                onClick={() => remove.mutate(pp.id)}
                                title="Verwijderen"
                              >
                                <ArrowLeft className="h-3.5 w-3.5" />
                              </Button>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">{pp.person.name}</p>
                                <p className="text-[10px] text-muted-foreground">
                                  {formatEUR(personLineCost(pp, days))}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
                {period.people.length === 0 && (
                  <p className="text-xs text-muted-foreground py-6 text-center">Nog geen personen in deze periode</p>
                )}
              </div>
            </ScrollArea>
          </section>
        </div>
      </CardContent>
    </Card>
  );
}
