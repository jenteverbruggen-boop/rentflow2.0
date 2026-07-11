"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatEUR } from "@/lib/pricing";
import type { Material, MaterialComponent } from "@/types";

interface BundleComponentRowProps {
  component: MaterialComponent;
  child?: Material;
  onQuantityChange: (quantity: number) => void;
  onRemove: () => void;
}

export function BundleComponentRow({
  component,
  child,
  onQuantityChange,
  onRemove,
}: BundleComponentRowProps) {
  const [qty, setQty] = useState(component.quantity);

  function commit() {
    const next = Math.max(1, qty || 1);
    setQty(next);
    if (next !== component.quantity) onQuantityChange(next);
  }

  return (
    <div className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-xs">
      <span className="min-w-0 flex-1 truncate">
        {child?.name ?? `#${component.childId}`}
      </span>
      <span className="text-muted-foreground">×</span>
      <Input
        type="number"
        min={1}
        value={qty}
        onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))}
        onBlur={commit}
        className="h-6 w-14 text-xs"
        aria-label="Aantal per set"
      />
      {child && (
        <span className="shrink-0 text-muted-foreground">
          {formatEUR(child.dayPrice * qty)}/d
        </span>
      )}
      <Button
        size="icon"
        variant="ghost"
        className="h-6 w-6 shrink-0 hover:text-destructive"
        onClick={onRemove}
      >
        ✕
      </Button>
    </div>
  );
}
