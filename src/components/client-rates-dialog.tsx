"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EntityCombobox } from "@/components/entity-combobox";
import { useClientRates } from "@/hooks/use-client-rates";
import type { Client, Function as Fn } from "@/types";

interface Props {
  client: Client | null;
  onClose: () => void;
}

/** L3.1 — per-client function rate cards, reachable from the Klanten
 * page. Module Kosten/Facturen (a rate card is a commercial term, not a
 * client-profile field) — gated server-side, not by this component. A
 * client with zero rows here is the default state every client starts
 * in; L3.2's booking picker must show every function in that case, not
 * none (own-data-scoping-design.md's own "empty rate card" reasoning
 * applies here too: the empty state must never silently mean "no
 * functions available"). */
export function ClientRatesDialog({ client, onClose }: Props) {
  const { query, create, update, remove } = useClientRates(client?.id ?? 0);
  const rates = query.data ?? [];
  const [error, setError] = useState("");

  const { data: functions = [] } = useQuery<Fn[]>({
    queryKey: ["functions"],
    queryFn: () => fetch("/api/functions").then((r) => r.json()),
    enabled: !!client,
  });

  const availableFunctions = functions.filter(
    (f) => !rates.some((r) => r.functionId === f.id),
  );

  async function addFunction(functionId: number) {
    create.mutate(
      { functionId, dayRate: null, hourRate: null },
      { onError: (err) => setError((err as Error).message) },
    );
    return { id: functionId };
  }

  function setRate(functionId: number, field: "dayRate" | "hourRate", raw: string) {
    const current = rates.find((r) => r.functionId === functionId);
    if (!current) return;
    const parsed = raw === "" ? null : Number(raw);
    update.mutate(
      { functionId, dayRate: current.dayRate, hourRate: current.hourRate, [field]: parsed },
      { onError: (err) => setError((err as Error).message) },
    );
  }

  return (
    <Dialog open={!!client} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Tarieven — {client?.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {error && <p className="text-xs text-destructive">{error}</p>}
          {rates.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Nog geen afspraken — boekingen voor deze klant gebruiken het standaardtarief per functie.
            </p>
          ) : (
            <div className="space-y-1.5">
              {rates.map((r) => (
                <div key={r.functionId} className="flex items-center gap-2 text-xs">
                  <span className="min-w-0 flex-1 truncate">{r.function?.name}</span>
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    placeholder="dagtarief"
                    value={r.dayRate ?? ""}
                    onChange={(e) => setRate(r.functionId, "dayRate", e.target.value)}
                    className="h-8 w-24"
                  />
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    placeholder="uurtarief"
                    value={r.hourRate ?? ""}
                    onChange={(e) => setRate(r.functionId, "hourRate", e.target.value)}
                    className="h-8 w-24"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-destructive hover:text-destructive"
                    onClick={() =>
                      remove.mutate(r.functionId, {
                        onError: (err) => setError((err as Error).message),
                      })
                    }
                  >
                    ×
                  </Button>
                </div>
              ))}
            </div>
          )}
          <EntityCombobox
            items={availableFunctions}
            value={null}
            onChange={(id) => id && addFunction(id)}
            placeholder="Functie toevoegen aan tarievenkaart..."
          />
          <div className="flex justify-end pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Sluiten</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
