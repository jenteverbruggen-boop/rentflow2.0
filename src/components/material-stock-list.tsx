"use client";

import { useState } from "react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { formatEUR } from "@/lib/pricing";
import { statusVariant } from "@/lib/utils";
import type { StockItem } from "@/types";

interface MaterialStockListProps {
  stockItems: StockItem[];
}

export function MaterialStockList({ stockItems }: MaterialStockListProps) {
  const [openId, setOpenId] = useState<number | null>(null);

  if (stockItems.length === 0) {
    return (
      <p className="text-xs text-muted-foreground py-4 text-center">
        Geen units gevonden voor dit materiaal
      </p>
    );
  }

  return (
    <div className="space-y-2 max-h-[45vh] overflow-y-auto pr-1">
      {stockItems.map((si) => {
        const open = openId === si.id;
        const assignments = si.assignments ?? [];
        return (
          <div key={si.id} className="rounded-md border border-border">
            <button
              type="button"
              onClick={() => setOpenId(open ? null : si.id)}
              className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-accent"
            >
              <span className="font-medium">Unit #{si.unitNumber}</span>
              <span className="text-muted-foreground">
                {assignments.length > 0
                  ? `${assignments.length} boeking(en)`
                  : "Niet geboekt"}{" "}
                · {open ? "Inklappen" : "Uitklappen"}
              </span>
            </button>
            {open && (
              <div className="px-3 pb-3 pt-1 text-xs text-muted-foreground space-y-1">
                <p>Identifier: {si.identifier ?? "-"}</p>
                <p>Notities: {si.notes ?? "-"}</p>
                {assignments.length > 0 ? (
                  <div className="pt-1 space-y-2">
                    {assignments.map((a) => (
                      <div
                        key={a.id}
                        className="rounded-md border border-border px-2 py-2 space-y-1"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-foreground font-medium truncate">
                            {a.period.project.name}
                          </p>
                          <Badge
                            className={statusVariant(a.period.project.status)}
                          >
                            {a.period.project.status}
                          </Badge>
                        </div>
                        <p>Periode: {a.period.name}</p>
                        <p>
                          Data:{" "}
                          {format(new Date(a.period.startDate), "d MMM yyyy", {
                            locale: nl,
                          })}{" "}
                          -{" "}
                          {format(new Date(a.period.endDate), "d MMM yyyy", {
                            locale: nl,
                          })}
                        </p>
                        <p>Locatie: {a.period.project.location ?? "-"}</p>
                        <p>Tarief snapshot: {formatEUR(a.dayPriceSnapshot)}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="pt-1">Boekingen: geen</p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
