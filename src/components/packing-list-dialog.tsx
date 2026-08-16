"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import type { Period, Project, PeriodStockItem } from "@/types";

interface Props {
  period: Period;
  project: Project;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Status = "not-shipped" | "out" | "overdue" | "back";

function statusOf(item: PeriodStockItem, periodEnded: boolean): Status {
  if (item.returnedAt) return "back";
  if (!item.shippedAt) return "not-shipped";
  return periodEnded ? "overdue" : "out";
}

const STATUS_LABEL: Record<Status, string> = {
  "not-shipped": "Nog niet verzonden",
  out: "Onderweg",
  overdue: "Te laat",
  back: "Terug",
};

const STATUS_VARIANT: Record<Status, "outline" | "secondary" | "destructive" | "default"> = {
  "not-shipped": "outline",
  out: "secondary",
  overdue: "destructive",
  back: "default",
};

/**
 * Per-period packing list (Future plan list item): a tick-box checklist
 * an operator works through as units are loaded and unloaded. Each row
 * is one physical `PeriodStockItem`, never a collapsed group — the
 * whole point is confirming exactly which unit went out and came back.
 */
export function PackingListDialog({ period, project, open, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const projectKey = ["project", String(project.id)] as const;
  const periodEnded = new Date(period.endDate) < new Date();

  const toggle = useMutation({
    mutationFn: async ({ assignmentId, field, value }: { assignmentId: number; field: "shipped" | "returned"; value: boolean }) => {
      const res = await fetch(`/api/periods/${period.id}/materials/${assignmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Bijwerken mislukt");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: projectKey }),
  });

  const sorted = [...period.materials].sort((a, b) =>
    a.stockItem.material.name.localeCompare(b.stockItem.material.name),
  );
  const outCount = period.materials.filter((m) => m.shippedAt && !m.returnedAt).length;
  const overdueCount = period.materials.filter((m) => statusOf(m, periodEnded) === "overdue").length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Paklijst — {period.name}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap gap-2 text-sm mb-2">
          <Badge variant="secondary">Onderweg: {outCount}</Badge>
          {overdueCount > 0 && <Badge variant="destructive">Te laat: {overdueCount}</Badge>}
        </div>

        {sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Geen materialen in deze periode</p>
        ) : (
          <ul className="space-y-1.5">
            {sorted.map((item) => {
              const status = statusOf(item, periodEnded);
              return (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      {item.stockItem.material.name}
                      {item.stockItem.identifier && (
                        <span className="text-muted-foreground"> · {item.stockItem.identifier}</span>
                      )}
                      {!item.stockItem.identifier && (
                        <span className="text-muted-foreground"> · #{item.stockItem.unitNumber}</span>
                      )}
                    </p>
                    <Badge variant={STATUS_VARIANT[status]} className="mt-1 text-[10px]">
                      {STATUS_LABEL[status]}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                      <Checkbox
                        checked={!!item.shippedAt}
                        disabled={toggle.isPending}
                        onCheckedChange={(checked) =>
                          toggle.mutate({ assignmentId: item.id, field: "shipped", value: checked === true })
                        }
                      />
                      Verzonden
                    </label>
                    <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                      <Checkbox
                        checked={!!item.returnedAt}
                        disabled={toggle.isPending || !item.shippedAt}
                        onCheckedChange={(checked) =>
                          toggle.mutate({ assignmentId: item.id, field: "returned", value: checked === true })
                        }
                      />
                      Terug
                    </label>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
