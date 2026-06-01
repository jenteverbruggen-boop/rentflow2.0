"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { formatEUR } from "@/lib/pricing";

interface Props {
  snapshot: number;
  basePrice: number;
  override: number | null;
  resnapshotUrl: string;
  projectId: number;
  kind: "material" | "person";
  entityId: number;
  entityName: string;
  invalidateKey: readonly unknown[];
}

function parsePrice(raw: string): number {
  return Number(raw.replace(",", ".").trim());
}

export function LinePricePopover({
  snapshot,
  basePrice,
  override,
  resnapshotUrl,
  projectId,
  kind,
  entityId,
  entityName,
  invalidateKey,
}: Props) {
  const queryClient = useQueryClient();
  const effective = override ?? basePrice;
  const drift = Math.abs(snapshot - effective) >= 0.005;
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<string>(String(override ?? ""));
  const [error, setError] = useState<string>("");

  const overrideUrl = `/api/projects/${projectId}/prices/${kind}/${entityId}`;
  const parsed = parsePrice(value);
  const parsedIsValid = value !== "" && !Number.isNaN(parsed) && parsed >= 0;
  const noChange = override != null && parsed === override;

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: invalidateKey });
    queryClient.invalidateQueries({ queryKey: ["available"] });
  };

  const resnapshot = useMutation({
    mutationFn: async () => {
      const res = await fetch(resnapshotUrl, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resnapshotPrice: true }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Bijwerken mislukt");
    },
    onSuccess: () => { setError(""); invalidateAll(); },
    onError: (err) => setError((err as Error).message),
  });

  const saveOverride = useMutation({
    mutationFn: async (dayPrice: number) => {
      const res = await fetch(overrideUrl, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dayPrice }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Opslaan mislukt");
    },
    onSuccess: () => { setError(""); invalidateAll(); setOpen(false); },
    onError: (err) => setError((err as Error).message),
  });

  const clearOverride = useMutation({
    mutationFn: async () => {
      const res = await fetch(overrideUrl, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error ?? "Verwijderen mislukt");
    },
    onSuccess: () => { setError(""); invalidateAll(); setOpen(false); },
    onError: (err) => setError((err as Error).message),
  });

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setValue(String(override ?? ""));
          setError("");
        }
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          title={drift ? "Prijsverschil — klik voor details" : override != null ? "Projectprijs ingesteld" : "Standaardprijs"}
          className={cn(
            "h-7 w-20 rounded-md border bg-background px-2 text-xs text-right tabular-nums print:hidden inline-flex items-center justify-end gap-1",
            "hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
            override != null
              ? "border-input font-medium"
              : "border-dashed border-input/60 text-muted-foreground"
          )}
        >
          {drift && <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />}
          <span>{formatEUR(effective)}</span>
        </button>
      </PopoverTrigger>
      <span className="hidden print:inline text-xs tabular-nums">{formatEUR(effective)}</span>
      <PopoverContent className="w-72 space-y-3">
        <div>
          <p className="text-xs font-semibold">{entityName}</p>
          <div className="text-xs text-muted-foreground space-y-0.5 mt-1">
            <p>Standaardprijs: {formatEUR(basePrice)}/d</p>
            <p>
              Projectprijs:{" "}
              {override != null ? (
                <span className="font-medium text-foreground">{formatEUR(override)}/d</span>
              ) : (
                <span>volgt standaard</span>
              )}
            </p>
            <p>Snapshot van deze regel: {formatEUR(snapshot)}/d</p>
          </div>
        </div>

        {drift && (
          <>
            <Separator />
            <div className="space-y-1.5">
              <p className="text-xs text-amber-600">
                ⚠ Deze regel heeft een ander snapshot dan de huidige projectprijs ({formatEUR(effective)}).
              </p>
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={() => resnapshot.mutate()}
                disabled={resnapshot.isPending}
              >
                {resnapshot.isPending ? "Bezig…" : `Werk alleen deze regel bij naar ${formatEUR(effective)}`}
              </Button>
            </div>
          </>
        )}

        <Separator />

        <div className="space-y-2">
          <Label className="text-xs">Projectprijs voor {entityName}</Label>
          <Input
            type="text"
            inputMode="decimal"
            placeholder={`${basePrice} (standaard) — bv. 12,50`}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="h-8"
          />
          <p className="text-[10px] text-muted-foreground">
            Past op alle boekingen van {entityName} in dit project (en op nieuwe boekingen).
          </p>
          {value !== "" && !parsedIsValid && (
            <p className="text-[10px] text-destructive">Ongeldig bedrag. Gebruik bv. 12,50 of 12.50.</p>
          )}
          {error && <p className="text-[10px] text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button
              size="sm"
              className="flex-1"
              disabled={saveOverride.isPending || !parsedIsValid || noChange}
              onClick={() => saveOverride.mutate(parsed)}
            >
              {saveOverride.isPending ? "Bezig…" : "Opslaan"}
            </Button>
            {override != null && (
              <Button
                size="sm"
                variant="outline"
                disabled={clearOverride.isPending}
                onClick={() => clearOverride.mutate()}
              >
                {clearOverride.isPending ? "…" : "Wissen"}
              </Button>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
