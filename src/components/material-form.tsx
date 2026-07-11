"use client";

import { useEffect, useState } from "react";
import { type Resolver, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { EntityCombobox } from "@/components/entity-combobox";
import type { Category, Material } from "@/types";

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
}

export function MaterialForm({ open, onOpenChange, defaultValues, onSubmit, isPending }: Props) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: { name: "", categoryId: null, dayPrice: 0, setupCost: 0, initialStock: 1, notes: "" },
  });
  const [catId, setCatId] = useState<number | null>(null);

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: () => fetch("/api/categories").then((r) => r.json()),
  });

  useEffect(() => {
    if (defaultValues) {
      setCatId(defaultValues.categoryId ?? null);
      form.reset({ name: defaultValues.name, categoryId: defaultValues.categoryId ?? null, dayPrice: defaultValues.dayPrice, setupCost: defaultValues.setupCost ?? 0, notes: defaultValues.notes ?? "" });
    } else {
      setCatId(null);
      form.reset({ name: "", categoryId: null, dayPrice: 0, setupCost: 0, initialStock: 1, notes: "" });
    }
  }, [defaultValues, form]);

  async function createCategory(name: string) {
    const res = await fetch("/api/categories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, prefix: "9999" }) });
    return res.json() as Promise<{ id: number }>;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{defaultValues ? "Materiaal bewerken" : "Nieuw materiaal"}</DialogTitle></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => onSubmit({ ...v, categoryId: catId }))} className="space-y-4">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem><FormLabel>Naam *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormItem>
              <FormLabel>Categorie</FormLabel>
              <EntityCombobox items={categories} value={catId} onChange={(id) => { setCatId(id); form.setValue("categoryId", id); }}
                onCreate={createCategory} placeholder="Selecteer categorie..." createLabel="+ Nieuwe categorie" />
            </FormItem>
            <FormField control={form.control} name="dayPrice" render={({ field }) => (
              <FormItem><FormLabel>Dagprijs (€)</FormLabel><FormControl><Input type="number" step="0.01" min={0} {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="setupCost" render={({ field }) => (
              <FormItem><FormLabel>Op-/afbouwkosten (€, per unit — optioneel)</FormLabel><FormControl><Input type="number" step="0.01" min={0} {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            {!defaultValues && (
              <FormField control={form.control} name="initialStock" render={({ field }) => (
                <FormItem><FormLabel>Aantal units bij start</FormLabel><FormControl><Input type="number" min={0} {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            )}
            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem><FormLabel>Notities</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <div className="flex gap-3 pt-2">
              <Button type="submit" className="flex-1" disabled={isPending}>{isPending ? "Bezig..." : defaultValues ? "Opslaan" : "Aanmaken"}</Button>
              <Button type="button" variant="secondary" className="flex-1" onClick={() => onOpenChange(false)}>Annuleren</Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
