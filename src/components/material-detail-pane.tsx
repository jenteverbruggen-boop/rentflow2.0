"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatEUR } from "@/lib/pricing";
import { statusVariant } from "@/lib/utils";
import type { Material, StockItem } from "@/types";

interface MaterialDetailPaneProps {
  material: Material | null;
  onManageUnits: () => void;
}

async function fetchStockItems(materialId: number): Promise<StockItem[]> {
  const res = await fetch(`/api/materials/${materialId}/stock-items`);
  if (!res.ok) throw new Error("Ophalen mislukt");
  return res.json() as Promise<StockItem[]>;
}

export function MaterialDetailPane({ material, onManageUnits }: MaterialDetailPaneProps) {
  const [openStockItemId, setOpenStockItemId] = useState<number | null>(null);

  const { data: stockItems = [] } = useQuery({
    queryKey: ["material", material?.id, "stock-items"],
    queryFn: () => fetchStockItems(material!.id),
    enabled: !!material,
  });

  if (!material) {
    return (
      <Card className="h-full">
        <CardContent className="h-full py-20 text-center text-sm text-muted-foreground">
          Selecteer links een materiaal om details te bekijken.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle>{material.name}</CardTitle>
            {material.category && <Badge variant="secondary" className="mt-2">{material.category}</Badge>}
          </div>
          <Button size="sm" variant="outline" onClick={onManageUnits}>Beheer units</Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-md border border-border p-3">
            <p className="text-xs text-muted-foreground">Dagprijs</p>
            <p className="font-medium">{formatEUR(material.dayPrice)}</p>
          </div>
          <div className="rounded-md border border-border p-3">
            <p className="text-xs text-muted-foreground">Totale voorraad</p>
            <p className="font-medium">{material.totalStock ?? 0} units</p>
          </div>
        </div>

        {material.notes && <p className="text-sm text-muted-foreground">{material.notes}</p>}

        <Separator />

        <div className="space-y-2">
          <p className="text-sm font-semibold">Per item</p>
          <p className="text-xs text-muted-foreground">
            Uitbreidbare unit-weergave voor toekomstige metadata en status.
          </p>

          <div className="space-y-2 max-h-[45vh] overflow-y-auto pr-1">
            {stockItems.map((si) => {
              const open = openStockItemId === si.id;
              const assignments = si.assignments ?? [];
              return (
                <div key={si.id} className="rounded-md border border-border">
                  <button
                    type="button"
                    onClick={() => setOpenStockItemId(open ? null : si.id)}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-accent"
                  >
                    <span className="font-medium">Unit #{si.unitNumber}</span>
                    <span className="text-muted-foreground">
                      {assignments.length > 0 ? `${assignments.length} boeking(en)` : "Niet geboekt"} · {open ? "Inklappen" : "Uitklappen"}
                    </span>
                  </button>
                  {open && (
                    <div className="px-3 pb-3 pt-1 text-xs text-muted-foreground space-y-1">
                      <p>Identifier: {si.identifier ?? "-"}</p>
                      <p>Notities: {si.notes ?? "-"}</p>
                      {assignments.length > 0 ? (
                        <div className="pt-1 space-y-2">
                          {assignments.map((assignment) => (
                            <div key={assignment.id} className="rounded-md border border-border px-2 py-2 space-y-1">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-foreground font-medium truncate">{assignment.period.project.name}</p>
                                <Badge className={statusVariant(assignment.period.project.status)}>
                                  {assignment.period.project.status}
                                </Badge>
                              </div>
                              <p>Periode: {assignment.period.name}</p>
                              <p>
                                Data: {format(new Date(assignment.period.startDate), "d MMM yyyy", { locale: nl })} - {" "}
                                {format(new Date(assignment.period.endDate), "d MMM yyyy", { locale: nl })}
                              </p>
                              <p>Locatie: {assignment.period.project.location ?? "-"}</p>
                              <p>Tarief snapshot: {formatEUR(assignment.dayPriceSnapshot)}</p>
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
            {stockItems.length === 0 && (
              <p className="text-xs text-muted-foreground py-4 text-center">Geen units gevonden voor dit materiaal</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}