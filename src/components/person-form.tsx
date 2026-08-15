"use client";

import { useEffect, useState } from "react";
import { type Resolver, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PersonFunctionChips, type FunctionAssignment } from "@/components/person-function-chips";
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
  onSubmit: (values: FormValues & { functions: FunctionAssignment[] }) => void;
  isPending: boolean;
}

export function PersonForm({ open, onOpenChange, defaultValues, onSubmit, isPending }: Props) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: { name: "", email: "", phone: "", dayPrice: 0, address: "", postalCode: "", city: "", country: "" },
  });
  const [selectedFns, setSelectedFns] = useState<FunctionAssignment[]>([]);
  const queryClient = useQueryClient();

  const { data: functions = [] } = useQuery<Fn[]>({
    queryKey: ["functions"],
    queryFn: () => fetch("/api/functions").then((r) => r.json()),
  });

  useEffect(() => {
    if (defaultValues) {
      form.reset({ name: defaultValues.name, email: defaultValues.email ?? "", phone: defaultValues.phone ?? "",
        dayPrice: defaultValues.dayPrice ?? 0, address: defaultValues.address ?? "", postalCode: defaultValues.postalCode ?? "",
        city: defaultValues.city ?? "", country: defaultValues.country ?? "" });
      setSelectedFns(
        defaultValues.functions?.map((f) => ({
          functionId: f.functionId,
          dayRate: f.dayRate,
          hourRate: f.hourRate,
        })) ?? [],
      );
    } else {
      form.reset({ name: "", email: "", phone: "", dayPrice: 0, address: "", postalCode: "", city: "", country: "" });
      setSelectedFns([]);
    }
  }, [defaultValues, form]);

  async function createFunction(name: string) {
    const res = await fetch("/api/functions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
    const created = (await res.json()) as { id: number };
    await queryClient.invalidateQueries({ queryKey: ["functions"] });
    return created;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
        <DialogHeader><DialogTitle>{defaultValues ? "Persoon bewerken" : "Nieuwe persoon"}</DialogTitle></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => onSubmit({ ...v, functions: selectedFns }))} className="space-y-3">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem><FormLabel>Naam *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="dayPrice" render={({ field }) => (
              <FormItem><FormLabel>Dagprijs (€)</FormLabel><FormControl><Input type="number" step="0.01" min={0} {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <PersonFunctionChips
              functions={functions}
              value={selectedFns}
              onChange={setSelectedFns}
              onCreateFunction={createFunction}
            />
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
