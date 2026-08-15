"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatEUR } from "@/lib/pricing";
import { scopeFunctionsToClientRates } from "@/lib/scope-functions-to-client";
import type { ClientFunctionRate, PersonAvailability } from "@/types";

const SOURCE_LABELS: Record<string, string> = {
  project: "projectafspraak",
  client: "klanttarief",
  "person-function": "persoonlijk tarief",
  function: "functietarief",
  person: "standaardtarief",
  none: "geen tarief",
};

interface Props {
  person: PersonAvailability | null;
  periodId: number;
  clientId: number | null;
  onConfirm: (args: { personId: number; role?: string; functionId: number | null }) => void;
  onClose: () => void;
  isPending: boolean;
}

/** L2.2/L3.2 — confirmation step for booking a person: defaults to
 * their sole function, requires an explicit choice when they have
 * several (Q19/L1), and shows the resolved rate + its source (L1.2,
 * via the preview-price endpoint) before the booking is actually
 * created. When the project's client has rate-card rows (L3), the
 * choice is further scoped to only the functions that client has
 * negotiated a rate for — a client with zero rows (the default state
 * every client starts in) must still offer every one of the person's
 * functions, never none. */
export function BookPersonDialog({ person, periodId, clientId, onConfirm, onClose, isPending }: Props) {
  const [functionId, setFunctionId] = useState<number | null>(null);
  const allFns = person?.person.functions ?? [];

  const { data: clientRates } = useQuery<ClientFunctionRate[]>({
    queryKey: ["client-rates", clientId],
    queryFn: () => fetch(`/api/clients/${clientId}/rates`).then((r) => r.json()),
    enabled: clientId != null,
  });

  const fns = scopeFunctionsToClientRates(allFns, clientRates ?? []);

  useEffect(() => {
    if (person) {
      setFunctionId(fns.length === 1 ? fns[0].functionId : null);
    }
    // fns is derived from `person`/`clientRates` every render — depending
    // on it directly would re-run on every render since it's a fresh
    // array each time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [person, clientRates]);

  const { data: preview } = useQuery({
    queryKey: ["preview-price", periodId, person?.person.id, functionId],
    queryFn: () =>
      fetch(
        `/api/periods/${periodId}/people/preview-price?personId=${person!.person.id}` +
          (functionId ? `&functionId=${functionId}` : ""),
      ).then((r) => r.json()) as Promise<{ dayPriceSnapshot: number | null; source: string }>,
    enabled: !!person,
  });

  const needsChoice = fns.length > 1 && functionId == null;

  return (
    <Dialog open={!!person} onOpenChange={(v) => !v && onClose()}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{person?.person.name} toevoegen</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {fns.length > 1 && (
            <div className="space-y-1.5">
              <Label className="text-xs">Functie</Label>
              <Select
                value={functionId != null ? String(functionId) : undefined}
                onValueChange={(v) => setFunctionId(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Kies een functie..." />
                </SelectTrigger>
                <SelectContent>
                  {fns.map((f) => (
                    <SelectItem key={f.functionId} value={String(f.functionId)}>
                      {f.function?.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {fns.length === 1 && (
            <p className="text-sm text-muted-foreground">Functie: {fns[0].function?.name}</p>
          )}
          {preview && (
            <p className="text-sm">
              Tarief: {preview.dayPriceSnapshot != null ? formatEUR(preview.dayPriceSnapshot) : "—"}
              <span className="text-xs text-muted-foreground">
                {" "}
                ({SOURCE_LABELS[preview.source] ?? preview.source})
              </span>
            </p>
          )}
          <div className="flex gap-2 pt-2">
            <Button
              disabled={needsChoice || isPending}
              onClick={() =>
                onConfirm({
                  personId: person!.person.id,
                  role: person!.person.role ?? undefined,
                  functionId,
                })
              }
            >
              {isPending ? "Bezig..." : "Toevoegen"}
            </Button>
            <Button variant="secondary" onClick={onClose}>
              Annuleren
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
