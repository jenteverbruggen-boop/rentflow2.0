"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatEUR } from "@/lib/pricing";
import type { PersonTravelCost } from "@/types";

interface PersonTravelEditorProps {
  periodId: number;
  assignmentId: number;
  travelCosts: PersonTravelCost[];
  invalidateKey: readonly string[];
}

export function PersonTravelEditor({
  periodId,
  assignmentId,
  travelCosts,
  invalidateKey,
}: PersonTravelEditorProps) {
  const queryClient = useQueryClient();
  const base = `/api/periods/${periodId}/people/${assignmentId}/travel`;
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: invalidateKey });

  const [label, setLabel] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [quantity, setQuantity] = useState("1");

  const add = useMutation({
    mutationFn: async () => {
      const res = await fetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: label || null, unitCost, quantity }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Mislukt");
    },
    onSuccess: () => {
      invalidate();
      setLabel("");
      setUnitCost("");
      setQuantity("1");
    },
  });

  const remove = useMutation({
    mutationFn: (id: number) => fetch(`${base}/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });

  return (
    <div className="mt-1.5 space-y-1 border-t border-border/60 pt-1.5">
      <p className="text-[11px] font-medium uppercase text-muted-foreground">
        ✈️ Reiskosten
      </p>
      {travelCosts.map((t) => (
        <div key={t.id} className="flex items-center gap-2 text-xs">
          <span className="min-w-0 flex-1 truncate">
            {t.label || "Reis"} · {t.quantity} × {formatEUR(t.unitCost)}
          </span>
          <span className="shrink-0 tabular-nums text-muted-foreground">
            {formatEUR(t.unitCost * t.quantity)}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 shrink-0 hover:text-destructive"
            onClick={() => remove.mutate(t.id)}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ))}
      <div className="flex items-center gap-1.5">
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Omschrijving"
          className="h-7 flex-1 text-xs"
          aria-label="Omschrijving reiskost"
        />
        <Input
          type="number"
          min={0}
          step="0.01"
          value={unitCost}
          onChange={(e) => setUnitCost(e.target.value)}
          placeholder="€"
          className="h-7 w-16 text-xs"
          aria-label="Bedrag per keer"
        />
        <span className="text-xs text-muted-foreground">×</span>
        <Input
          type="number"
          min={1}
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          className="h-7 w-12 text-xs"
          aria-label="Aantal keer"
        />
        <Button
          size="sm"
          className="h-7 px-2"
          disabled={!unitCost || add.isPending}
          onClick={() => add.mutate()}
        >
          +
        </Button>
      </div>
    </div>
  );
}
