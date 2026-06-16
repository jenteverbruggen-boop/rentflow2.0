"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { useMaterialAvailability } from "@/hooks/use-availability";
import { formatEUR, periodDays, lineCost } from "@/lib/pricing";
import { groupMaterialAssignments } from "@/lib/grouping";
import { cn } from "@/lib/utils";
import type { MaterialAvailability, Period, Project } from "@/types";

interface Props {
  period: Period;
  project: Project;
  onWarnings: (warnings: string[]) => void;
  onError: (error: string) => void;
}

export function MaterialSplitEditor({ period, project, onWarnings, onError }: Props) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [collapsedLeft, setCollapsedLeft] = useState<Set<string>>(new Set());
  const [collapsedRight, setCollapsedRight] = useState<Set<string>>(new Set());
  const [qtyMap, setQtyMap] = useState<Record<number, number>>({});

  const range = {
    from: period.startDate.slice(0, 10),
    to: period.endDate.slice(0, 10),
    sameProjectId: project.id,
    projectId: project.id,
  };
  const mats = useMaterialAvailability(range);
  const days = periodDays(period);
  const groups = groupMaterialAssignments(period.materials);

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

  const byCategory = useMemo(() => {
    const map = new Map<string, MaterialAvailability[]>();
    for (const m of filtered) {
      const cat = m.material.category ?? "Overig";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(m);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

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

  const groupsByCategory = useMemo(() => {
    const map = new Map<string, typeof groups>();
    for (const g of groups) {
      const cat = g.material.category ?? "Overig";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(g);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [groups]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["project", String(project.id)] });
    queryClient.invalidateQueries({ queryKey: ["available"] });
  };

  const add = useMutation({
    mutationFn: async (args: { materialId: number; quantity: number }) => {
      const res = await fetch(`/api/periods/${period.id}/materials`, {
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

  const removeOne = useMutation({
    mutationFn: (assignmentId: number) =>
      fetch(`/api/periods/${period.id}/materials/${assignmentId}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });

  return (
    <Card>
      <CardContent className="pt-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <section className="rounded-lg border border-border overflow-hidden md:rounded-none md:border-0 md:overflow-visible md:space-y-2">
            <div className="bg-muted/60 px-3 py-2.5 border-b border-border md:hidden">
              <h4 className="text-sm font-semibold">Beschikbaar</h4>
            </div>
            <h4 className="hidden md:block text-xs font-semibold uppercase text-muted-foreground">Beschikbaar</h4>
            <div className="p-3 space-y-2 md:p-0">
            <Input placeholder="Zoeken op naam of categorie..." value={search} onChange={(e) => setSearch(e.target.value)} />
            <ScrollArea className="h-[400px] pr-2">
              <div className="space-y-2">
                {byCategory.map(([cat, items]) => {
                  const isCollapsed = collapsedLeft.has(cat);
                  return (
                    <div key={cat}>
                      <button
                        type="button"
                        className="flex items-center gap-1 text-xs font-semibold uppercase text-muted-foreground w-full hover:text-foreground"
                        onClick={() => toggleLeft(cat)}
                      >
                        {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        <span>{cat}</span>
                        <span className="font-normal normal-case ml-1">({items.length})</span>
                      </button>
                      {!isCollapsed && (
                        <div className="space-y-1 mt-1 ml-4">
                          {items.map((m) => {
                            const qty = qtyMap[m.material.id] ?? 1;
                            return (
                              <div key={m.material.id} className="flex flex-wrap items-center gap-x-1.5 gap-y-1 bg-muted/30 rounded px-2 py-1.5 text-xs">
                                <div className="flex-1 min-w-[120px]">
                                  <p className="font-medium truncate">{m.material.name}</p>
                                  <p className="text-[10px] text-muted-foreground truncate">
                                    {m.availableCount}/{m.totalStock} vrij · {formatEUR(m.material.dayPrice)}/d
                                  </p>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <Input
                                    type="number"
                                    min={1}
                                    max={m.availableCount}
                                    value={qty}
                                    onChange={(e) => setQtyMap((q) => ({ ...q, [m.material.id]: Math.max(1, parseInt(e.target.value) || 1) }))}
                                    className="w-12 h-7 text-xs"
                                  />
                                  <Button
                                    size="icon"
                                    className="h-7 w-7"
                                    disabled={add.isPending || qty > m.availableCount}
                                    onClick={() => add.mutate({ materialId: m.material.id, quantity: qty })}
                                    title="Toevoegen aan periode"
                                  >
                                    <ArrowRight className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
                {byCategory.length === 0 && (
                  <p className="text-xs text-muted-foreground py-6 text-center">Geen materialen gevonden</p>
                )}
              </div>
            </ScrollArea>
            </div>
          </section>

          <section className="rounded-lg border border-border overflow-hidden md:rounded-none md:border-0 md:overflow-visible md:space-y-2">
            <div className="bg-muted/60 px-3 py-2.5 border-b border-border md:hidden">
              <h4 className="text-sm font-semibold">In "{period.name}"</h4>
            </div>
            <h4 className="hidden md:block text-xs font-semibold uppercase text-muted-foreground">In "{period.name}"</h4>
            <div className="hidden md:block h-9" aria-hidden />
            <div className="p-3 md:p-0">
            <ScrollArea className="h-[400px] pr-2">
              <div className="space-y-2">
                {groupsByCategory.map(([cat, items]) => {
                  const isCollapsed = collapsedRight.has(cat);
                  return (
                    <div key={cat}>
                      <button
                        type="button"
                        className="flex items-center gap-1 text-xs font-semibold uppercase text-muted-foreground w-full hover:text-foreground"
                        onClick={() => toggleRight(cat)}
                      >
                        {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        <span>{cat}</span>
                        <span className="font-normal normal-case ml-1">({items.length})</span>
                      </button>
                      {!isCollapsed && (
                        <div className="space-y-1 mt-1 ml-4">
                          {items.map((g) => {
                            const perUnit = lineCost(g.dayPriceSnapshot, days, g);
                            return (
                              <div key={g.key} className="flex items-center gap-1.5 bg-muted/40 rounded px-2 py-1 text-xs">
                                <Button
                                  size="icon"
                                  variant="outline"
                                  className="h-7 w-7"
                                  onClick={() => removeOne.mutate(g.assignments[g.assignments.length - 1].id)}
                                  title="Eén unit verwijderen"
                                >
                                  <ArrowLeft className="h-3.5 w-3.5" />
                                </Button>
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium truncate">
                                    {g.material.name} <span className="text-muted-foreground">×{g.units}</span>
                                  </p>
                                  <p className="text-[10px] text-muted-foreground">
                                    {g.units} × {formatEUR(perUnit)} = {formatEUR(perUnit * g.units)}
                                  </p>
                                </div>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className={cn("h-7 w-7 hover:text-destructive", g.units < 2 && "invisible")}
                                  onClick={() => {
                                    for (const a of g.assignments) removeOne.mutate(a.id);
                                  }}
                                  title="Alle units verwijderen"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
                {groups.length === 0 && (
                  <p className="text-xs text-muted-foreground py-6 text-center">Nog geen materialen in deze periode</p>
                )}
              </div>
            </ScrollArea>
            </div>
          </section>
        </div>
      </CardContent>
    </Card>
  );
}
