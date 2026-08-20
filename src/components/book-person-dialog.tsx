"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { BookPersonFields, type BlockingProject } from "@/components/book-person-fields";
import { scopeFunctionsToClientRates } from "@/lib/scope-functions-to-client";
import { useBookingPricePreview } from "@/hooks/use-booking-price-preview";
import type { ClientFunctionRate, PersonAvailability } from "@/types";

interface BookError extends Error { blockingProject?: BlockingProject }

interface Props {
  person: PersonAvailability | null;
  periodId: number;
  clientId: number | null;
  onBooked: (warnings: string[]) => void;
  onClose: () => void;
}

/** L2.2/L3.2/H2.1 — confirmation step for booking a person: defaults to
 * their sole function, requires an explicit choice when they have
 * several, shows the resolved rate + source, and — if the person turns
 * out to already be booked elsewhere during this window — surfaces
 * that conflict (naming the project and window, via BookPersonFields)
 * with a "book anyway" override rather than a bare error. The API
 * still refuses without `allowOverlap`; this dialog is the only path
 * that can set it, after the user has actually seen what they're
 * overriding. */
export function BookPersonDialog({ person, periodId, clientId, onBooked, onClose }: Props) {
  const [functionId, setFunctionId] = useState<number | null>(null);
  const [unit, setUnit] = useState<"dag" | "uur">("dag");
  const [conflict, setConflict] = useState<BlockingProject | null>(null);
  const [error, setError] = useState("");
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
      setUnit("dag");
      setConflict(null);
      setError("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [person, clientRates]);

  const { preview, hasHourRate } = useBookingPricePreview(periodId, person?.person.id, functionId, unit);

  useEffect(() => {
    if (!hasHourRate) setUnit("dag");
  }, [hasHourRate]);

  const book = useMutation({
    mutationFn: async (allowOverlap: boolean) => {
      const res = await fetch(`/api/periods/${periodId}/people`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personId: person!.person.id,
          functionId,
          billingUnit: unit,
          allowOverlap,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const err = new Error(data.error ?? "Toevoegen mislukt") as BookError;
        if (res.status === 409 && data.blockingProject) err.blockingProject = data.blockingProject;
        throw err;
      }
      return data as { warnings: string[] };
    },
    onSuccess: (data) => onBooked(data.warnings ?? []),
    onError: (err: BookError) => {
      setConflict(err.blockingProject ?? null);
      setError(err.blockingProject ? "" : err.message);
    },
  });

  const needsChoice = fns.length > 1 && functionId == null;

  return (
    <Dialog open={!!person} onOpenChange={(v) => !v && onClose()}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{person?.person.name} toevoegen</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <BookPersonFields
            personName={person?.person.name}
            fns={fns}
            functionId={functionId}
            onFunctionChange={setFunctionId}
            unit={unit}
            onUnitChange={setUnit}
            hasHourRate={hasHourRate}
            preview={preview}
            conflict={conflict}
            error={error}
          />
          <div className="flex gap-2 pt-2">
            {conflict ? (
              <Button variant="destructive" disabled={book.isPending} onClick={() => book.mutate(true)}>
                {book.isPending ? "Bezig..." : "Toch dubbel boeken"}
              </Button>
            ) : (
              <Button disabled={needsChoice || book.isPending} onClick={() => book.mutate(false)}>
                {book.isPending ? "Bezig..." : "Toevoegen"}
              </Button>
            )}
            <Button variant="secondary" onClick={onClose}>
              Annuleren
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
