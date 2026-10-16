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
import type { SupplierValues } from "@/hooks/use-suppliers";
import type { Supplier } from "@/types";

const schema = z.object({
  name: z.string().trim().min(1, "Naam is verplicht"),
  contactName: z.string(),
  email: z.string(),
  phone: z.string(),
  address: z.string(),
  postalCode: z.string(),
  city: z.string(),
  vatNumber: z.string(),
  notes: z.string(),
});
type Values = z.infer<typeof schema>;

const EMPTY: Values = { name: "", contactName: "", email: "", phone: "", address: "", postalCode: "", city: "", vatNumber: "", notes: "" };
const toForm = (s: Supplier): Values => ({
  name: s.name, contactName: s.contactName ?? "", email: s.email ?? "", phone: s.phone ?? "", address: s.address ?? "",
  postalCode: s.postalCode ?? "", city: s.city ?? "", vatNumber: s.vatNumber ?? "", notes: s.notes ?? "",
});

const FIELDS: { name: keyof Values; label: string }[] = [
  { name: "contactName", label: "Contactpersoon" }, { name: "email", label: "E-mail" }, { name: "phone", label: "Telefoon" },
  { name: "vatNumber", label: "BTW-nummer" }, { name: "address", label: "Adres" }, { name: "postalCode", label: "Postcode" }, { name: "city", label: "Gemeente" },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultValues?: Supplier | null;
  isPending: boolean;
  error?: string;
  onSubmit: (values: SupplierValues) => void;
}

/** Create/edit a supplier: who you rent material from when you don't stock it. */
export function SupplierForm({ open, onOpenChange, defaultValues, isPending, error, onSubmit }: Props) {
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: EMPTY });
  useEffect(() => { if (open) form.reset(defaultValues ? toForm(defaultValues) : EMPTY); }, [open, defaultValues, form]);

  // Empty text means "not filled in": send null so a cleared field is cleared.
  const blank = (v: string) => (v.trim() === "" ? null : v.trim());
  const submit = (v: Values) =>
    onSubmit({
      name: v.name.trim(), contactName: blank(v.contactName), email: blank(v.email), phone: blank(v.phone),
      address: blank(v.address), postalCode: blank(v.postalCode), city: blank(v.city),
      vatNumber: blank(v.vatNumber), notes: blank(v.notes),
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto" aria-describedby={undefined}>
        <DialogHeader><DialogTitle>{defaultValues ? "Leverancier bewerken" : "Nieuwe leverancier"}</DialogTitle></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(submit)} className="space-y-3">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem><FormLabel>Naam *</FormLabel><FormControl><Input {...field} placeholder="bv. Funrent" /></FormControl><FormMessage /></FormItem>
            )} />
            <div className="grid gap-3 sm:grid-cols-2">
              {FIELDS.map((f) => (
                <FormField key={f.name} control={form.control} name={f.name} render={({ field }) => (
                  <FormItem><FormLabel>{f.label}</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                )} />
              ))}
            </div>
            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem><FormLabel>Notities</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl></FormItem>
            )} />
            {error && <p className="text-xs text-destructive">{error}</p>}
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
