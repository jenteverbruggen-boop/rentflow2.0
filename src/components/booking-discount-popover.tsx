"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { formatEUR } from "@/lib/pricing";

interface Props {
  discountPct: number | null;
  discountAmount: number | null;
  /** PATCH urls — one per affected assignment. A material group passes its full assignment list */
  patchUrls: string[];
  invalidateKey: readonly unknown[];
}

type Mode = "none" | "pct" | "amount";

export function BookingDiscountPopover({ discountPct, discountAmount, patchUrls, invalidateKey }: Props) {
  const queryClient = useQueryClient();
  const initialMode: Mode = discountPct != null ? "pct" : discountAmount != null ? "amount" : "none";
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>(initialMode);
  const [value, setValue] = useState(
    discountPct != null ? String(discountPct) : discountAmount != null ? String(discountAmount) : ""
  );

  const parsed = Number(value.replace(",", ".").trim());

  const save = useMutation({
    mutationFn: async () => {
      const body =
        mode === "pct"
          ? { discountPct: parsed, discountAmount: null }
          : mode === "amount"
          ? { discountAmount: parsed, discountPct: null }
          : { discountPct: null, discountAmount: null };
      await Promise.all(
        patchUrls.map((url) =>
          fetch(url, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          })
        )
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invalidateKey });
      setOpen(false);
    },
  });

  const label =
    discountPct != null
      ? `−${discountPct}%`
      : discountAmount != null
      ? `−${formatEUR(discountAmount)}`
      : "";
  const hasDiscount = discountPct != null || discountAmount != null;

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setMode(initialMode);
          setValue(
            discountPct != null ? String(discountPct) : discountAmount != null ? String(discountAmount) : ""
          );
        }
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "h-7 w-20 rounded-md border bg-background px-2 text-xs text-left print:hidden",
            "hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
            hasDiscount ? "border-input font-medium" : "border-dashed border-input/60 text-muted-foreground"
          )}
        >
          {hasDiscount ? label : <span className="opacity-60">−% / −€</span>}
        </button>
      </PopoverTrigger>
      {hasDiscount && (
        <span className="hidden print:inline text-xs font-medium">{label}</span>
      )}
      <PopoverContent className="w-64 space-y-3">
        <div>
          <Label className="text-xs">Soort korting</Label>
          <div className="flex gap-1 mt-1">
            <Button type="button" size="sm" variant={mode === "none" ? "default" : "outline"} className="flex-1 text-xs h-7" onClick={() => setMode("none")}>Geen</Button>
            <Button type="button" size="sm" variant={mode === "pct" ? "default" : "outline"} className="flex-1 text-xs h-7" onClick={() => setMode("pct")}>%</Button>
            <Button type="button" size="sm" variant={mode === "amount" ? "default" : "outline"} className="flex-1 text-xs h-7" onClick={() => setMode("amount")}>€</Button>
          </div>
        </div>
        {mode !== "none" && (
          <div>
            <Label className="text-xs">
              {mode === "pct" ? "Percentage" : "Bedrag per regel (€)"}
            </Label>
            <Input
              type="text"
              inputMode="decimal"
              placeholder="bv. 10 of 12,50"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="h-8 mt-1"
              autoFocus
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              {mode === "pct"
                ? "Toegepast op snapshot × dagen"
                : "Vast bedrag dat wordt afgetrokken per regel (per unit voor materialen)"}
            </p>
          </div>
        )}
        <Button
          size="sm"
          className="w-full"
          disabled={save.isPending || (mode !== "none" && (value === "" || Number.isNaN(parsed) || parsed < 0))}
          onClick={() => save.mutate()}
        >
          {save.isPending ? "Bezig…" : "Opslaan"}
        </Button>
      </PopoverContent>
    </Popover>
  );
}
