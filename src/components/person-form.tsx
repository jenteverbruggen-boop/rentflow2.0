"use client";

import { useEffect, useState } from "react";
import { type Resolver, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EntityCombobox } from "@/components/entity-combobox";
import type { Function as Fn, Person } from "@/types";

const schema = z.object({
  name: z.string().min(1, "Naam is verplicht"),
  email: z.string().email("Ongeldig emailadres").optional().or(z.literal("")),
  phone: z.string().optional(),
  dayPrice: z.coerce.number().min(0, "Moet ≥ 0 zijn"),
  address: z.string().optional(),
  postalCode: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultValues?: Person | null;
  onSubmit: (values: FormValues & { functionIds: number[] }) => void;
  isPending: boolean;
}

export function PersonForm({ open, onOpenChange, defaultValues, onSubmit, isPending }: Props) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: { name: "", email: "", phone: "", dayPrice: 0, address: "", postalCode: "", city: "", country: "" },
  });
  const [selectedFnIds, setSelectedFnIds] = useState<number[]>([]);

  const { data: functions = [] } = useQuery<Fn[]>({
    queryKey: ["functions"],
    queryFn: () => fetch("/api/functions").then((r) => r.json()),
  });

  useEffect(() => {
    if (defaultValues) {
      form.reset({ name: defaultValues.name, email: defaultValues.email ?? "", phone: defaultValues.phone ?? "",
        dayPrice: defaultValues.dayPrice, address: defaultValues.address ?? "", postalCode: defaultValues.postalCode ?? "",
        city: defaultValues.city ?? "", country: defaultValues.country ?? "" });
      setSelectedFnIds(defaultValues.functions?.map((f) => f.id) ?? []);
    } else {
      form.reset({ name: "", email: "", phone: "", dayPrice: 0, address: "", postalCode: "", city: "", country: "" });
      setSelectedFnIds([]);
    }
  }, [defaultValues, form]);

  async function createFunction(name: string) {
    const res = await fetch("/api/functions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
    return res.json() as Promise<{ id: number }>;
  }

  function toggleFn(id: number) {
    setSelectedFnIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{defaultValues ? "Persoon bewerken" : "Nieuwe persoon"}</DialogTitle></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => onSubmit({ ...v, functionIds: selectedFnIds }))} className="space-y-3">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem><FormLabel>Naam *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="dayPrice" render={({ field }) => (
              <FormItem><FormLabel>Dagprijs (€)</FormLabel><FormControl><Input type="number" step="0.01" min={0} {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <div>
              <p className="text-sm font-medium mb-1">Functies</p>
              <div className="flex flex-wrap gap-1 mb-2">
                {selectedFnIds.map((id) => {
                  const fn = functions.find((f) => f.id === id);
                  return fn ? <Badge key={id} variant="secondary" className="cursor-pointer" onClick={() => toggleFn(id)}>{fn.name} ×</Badge> : null;
                })}
              </div>
              <EntityCombobox
                items={functions.filter((f) => !selectedFnIds.includes(f.id))}
                value={null} onChange={(id) => id && toggleFn(id)}
                onCreate={createFunction} placeholder="Functie toevoegen..." createLabel="+ Nieuwe functie"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="phone" render={({ field }) => (
                <FormItem><FormLabel>Telefoon</FormLabel><FormControl><Input type="tel" {...field} /></FormControl></FormItem>
              )} />
            </div>
            <FormField control={form.control} name="address" render={({ field }) => (
              <FormItem><FormLabel>Adres</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
            )} />
            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="postalCode" render={({ field }) => (
                <FormItem><FormLabel>Postcode</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
              )} />
              <FormField control={form.control} name="city" render={({ field }) => (
                <FormItem><FormLabel>Gemeente</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
              )} />
            </div>
            <FormField control={form.control} name="country" render={({ field }) => (
              <FormItem><FormLabel>Land</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
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
