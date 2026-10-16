"use client";

import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useCategories } from "@/hooks/use-categories";
import { priceListQueryString } from "@/hooks/use-price-list";
import type { PriceListOptions } from "@/lib/price-list";
import type { Client } from "@/types";

const NO_CLIENT = "__none__";

interface Props {
  value: PriceListOptions;
  onChange: (next: PriceListOptions) => void;
  /** Crew rates are `personen` data; a client's card is `klanten` data. */
  canCrew: boolean;
  canClients: boolean;
}

function Check({ id, checked, onChange, children }: { id: string; checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <Checkbox id={id} checked={checked} onCheckedChange={(v) => onChange(v === true)} />
      <Label htmlFor={id} className="font-normal">{children}</Label>
    </div>
  );
}

/** What goes on the price list. Everything here only shapes the output; the
 * server decides what the caller may actually generate. */
export function PriceListOptionsPanel({ value, onChange, canCrew, canClients }: Props) {
  const { categories } = useCategories();
  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["clients"],
    enabled: canClients,
    queryFn: () => fetch("/api/clients").then((r) => r.json()),
  });
  const set = (patch: Partial<PriceListOptions>) => onChange({ ...value, ...patch });
  const toggleCategory = (id: number, on: boolean) => {
    const current = value.categoryIds ?? categories.map((c) => c.id);
    const next = on ? [...current, id] : current.filter((c) => c !== id);
    set({ categoryIds: next.length === categories.length ? null : next });
  };

  return (
    <div className="no-print rounded-lg border bg-card p-4 space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label className="text-xs">Categorieën</Label>
          <div className="grid gap-1.5 max-h-40 overflow-y-auto">
            {categories.map((c) => (
              <Check key={c.id} id={`cat-${c.id}`} checked={value.categoryIds === null || value.categoryIds.includes(c.id)} onChange={(on) => toggleCategory(c.id, on)}>
                {c.name}
              </Check>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <Check id="sets" checked={value.includeSets} onChange={(v) => set({ includeSets: v })}>Sets opnemen</Check>
          <Check id="zero" checked={value.hideZero} onChange={(v) => set({ hideZero: v })}>Items zonder prijs verbergen</Check>
          {canCrew && <Check id="crew" checked={value.includeCrew} onChange={(v) => set({ includeCrew: v, ...(v ? {} : { clientId: null }) })}>Tarieven personeel opnemen</Check>}
          <div className="space-y-1.5 pt-1">
            <Label className="text-xs">Bedragen</Label>
            <Select value={value.vat} onValueChange={(v) => set({ vat: v as "excl" | "incl" })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="excl">Exclusief BTW</SelectItem>
                <SelectItem value="incl">Inclusief BTW</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {canCrew && canClients && value.includeCrew && (
            <div className="space-y-1.5">
              <Label className="text-xs">Tarieven van klant</Label>
              <Select value={value.clientId == null ? NO_CLIENT : String(value.clientId)} onValueChange={(v) => set({ clientId: v === NO_CLIENT ? null : Number(v) })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_CLIENT}>Standaardtarieven</SelectItem>
                  {clients.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>
      <Button variant="outline" size="sm" asChild>
        <a href={`/api/price-list/export?${priceListQueryString(value)}`}>
          <Download className="h-4 w-4 mr-1" aria-hidden /> Excel
        </a>
      </Button>
    </div>
  );
}
