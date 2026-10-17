"use client";

import { useEffect, useState } from "react";
import { type Resolver, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { EntityCombobox } from "@/components/entity-combobox";
import { useCategories } from "@/hooks/use-categories";
import { useAuthMe } from "@/hooks/use-auth-me";
import { canWriteMoney } from "@/lib/me-access";
import { MaterialFormSubhire, EMPTY_SUBHIRE, subhirePayload, type SubhireFormState } from "@/components/material-form-subhire";
import { PriceBasisSelect } from "@/components/price-basis-select";
import type { Material, PriceBasis } from "@/types";

const schema = z.object({
  name: z.string().min(1, "Naam is verplicht"),
  categoryId: z.number().optional().nullable(),
  dayPrice: z.coerce.number().min(0, "Moet ≥ 0 zijn"),
  setupCost: z.coerce.number().min(0, "Moet ≥ 0 zijn").optional(),
  initialStock: z.coerce.number().int().min(0).optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultValues?: Material | null;
  onSubmit: (values: FormValues) => void;
  isPending: boolean;
  error?: string | null;
}

export function MaterialForm({ open, onOpenChange, defaultValues, onSubmit, isPending, error }: Props) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: { name: "", categoryId: null, dayPrice: 0, setupCost: 0, initialStock: 1, notes: "" },
  });
  const [catId, setCatId] = useState<number | null>(null);
  const [subhire, setSubhire] = useState<SubhireFormState>(EMPTY_SUBHIRE);
  // null = not chosen: per day, or per rental for an inhuur-only item.
  const [basis, setBasis] = useState<PriceBasis | null>(null);
  const { data: me } = useAuthMe();
  const subhireInvalid = !defaultValues && subhire.only && subhire.supplierId === "";
  const { categories, createCategory } = useCategories();

  useEffect(() => {
    if (defaultValues) {
      setCatId(defaultValues.categoryId ?? null);
      form.reset({ name: defaultValues.name, categoryId: defaultValues.categoryId ?? null, dayPrice: defaultValues.dayPrice ?? 0, setupCost: defaultValues.setupCost ?? 0, notes: defaultValues.notes ?? "" });
    } else {
      setCatId(null);
      setSubhire(EMPTY_SUBHIRE);
      setBasis(null);
      form.reset({ name: "", categoryId: null, dayPrice: 0, setupCost: 0, initialStock: 1, notes: "" });
    }
  }, [defaultValues, form]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" aria-describedby={undefined}>
        <DialogHeader><DialogTitle>{defaultValues ? "Materiaal bewerken" : "Nieuw materiaal"}</DialogTitle></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => onSubmit({
            ...v,
            categoryId: catId,
            ...(defaultValues ? {} : { priceBasis: basis ?? (subhire.only ? "per_huur" : "per_dag") }),
            // An inhuur-only item has no stock of its own.
            ...(subhire.only ? { initialStock: 0 } : {}),
            ...(defaultValues ? {} : subhirePayload(subhire, canWriteMoney(me))),
          }))} className="space-y-4">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem><FormLabel>Naam *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <div className="space-y-2">
              <Label>Categorie</Label>
              <EntityCombobox items={categories} value={catId} onChange={(id) => { setCatId(id); form.setValue("categoryId", id); }}
                onCreate={createCategory} placeholder="Selecteer categorie..." createLabel="+ Nieuwe categorie" />
            </div>
            <FormField control={form.control} name="dayPrice" render={({ field }) => (
              <FormItem><FormLabel>Prijs (€)</FormLabel><FormControl><Input type="number" step="0.01" min={0} {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            {!defaultValues && canWriteMoney(me) && (
              <div className="space-y-2">
                <Label>Prijs gerekend per</Label>
                <PriceBasisSelect value={basis ?? (subhire.only ? "per_huur" : "per_dag")} onChange={setBasis} />
              </div>
            )}
            <FormField control={form.control} name="setupCost" render={({ field }) => (
              <FormItem><FormLabel>Op-/afbouwkosten (€, per unit — optioneel)</FormLabel><FormControl><Input type="number" step="0.01" min={0} {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            {!defaultValues && <MaterialFormSubhire value={subhire} onChange={setSubhire} />}
            {!defaultValues && !subhire.only && (
              <FormField control={form.control} name="initialStock" render={({ field }) => (
                <FormItem><FormLabel>Aantal units bij start</FormLabel><FormControl><Input type="number" min={0} {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            )}
            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem><FormLabel>Notities</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            {error && (
              <p className="text-sm text-destructive" role="alert">{error}</p>
            )}
            <div className="flex gap-3 pt-2">
              <Button type="submit" className="flex-1" disabled={isPending || subhireInvalid}>{isPending ? "Bezig..." : defaultValues ? "Opslaan" : "Aanmaken"}</Button>
              <Button type="button" variant="secondary" className="flex-1" onClick={() => onOpenChange(false)}>Annuleren</Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
