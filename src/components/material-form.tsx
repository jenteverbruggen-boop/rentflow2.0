"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import type { Material } from "@/types";

const schema = z.object({
  name: z.string().min(1, "Naam is verplicht"),
  category: z.string().optional(),
  dayPrice: z.coerce.number().min(0, "Moet ≥ 0 zijn"),
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
    resolver: zodResolver(schema),
    defaultValues: { name: "", category: "", dayPrice: 0, initialStock: 1, notes: "" },
  });

  useEffect(() => {
    if (defaultValues) {
      form.reset({
        name: defaultValues.name,
        category: defaultValues.category ?? "",
        dayPrice: defaultValues.dayPrice,
        notes: defaultValues.notes ?? "",
      });
    } else {
      form.reset({ name: "", category: "", dayPrice: 0, initialStock: 1, notes: "" });
    }
  }, [defaultValues, form]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{defaultValues ? "Materiaal bewerken" : "Nieuw materiaal"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem><FormLabel>Naam *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="category" render={({ field }) => (
              <FormItem><FormLabel>Categorie</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="dayPrice" render={({ field }) => (
              <FormItem><FormLabel>Dagprijs (€)</FormLabel><FormControl><Input type="number" step="0.01" min={0} {...field} /></FormControl><FormMessage /></FormItem>
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
              <Button type="submit" className="flex-1" disabled={isPending}>
                {isPending ? "Bezig..." : defaultValues ? "Opslaan" : "Aanmaken"}
              </Button>
              <Button type="button" variant="secondary" className="flex-1" onClick={() => onOpenChange(false)}>
                Annuleren
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
