"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import type { Invoice } from "@/types";

const schema = z.object({
  notes: z.string().max(2000, "Maximaal 2000 tekens"),
  footer: z.string().max(2000, "Maximaal 2000 tekens"),
  paymentTermDays: z.string().refine((v) => v === "" || (Number.isInteger(Number(v)) && Number(v) >= 1 && Number(v) <= 365), "Geef 1 tot 365 dagen in"),
});
type Values = z.infer<typeof schema>;

const toForm = (i: Invoice): Values => ({
  notes: i.notes ?? "", footer: i.footer ?? "", paymentTermDays: i.paymentTermDays == null ? "" : String(i.paymentTermDays),
});

interface Props {
  invoice: Invoice;
  /** A quote's "term" is how long it stays valid, not a payment term. */
  isQuote?: boolean;
  defaultFooter: string;
  defaultTermDays: number;
  isPending: boolean;
  onSave: (values: { notes: string | null; footer: string | null; paymentTermDays: number | null }) => void;
}

/** A draft's own text: remarks printed above the payment block, a footer that
 * replaces the company default for this invoice, and the payment term the due
 * date is computed from when the invoice is sent. */
export function InvoiceMetaForm({ invoice, isQuote, defaultFooter, defaultTermDays, isPending, onSave }: Props) {
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: toForm(invoice) });
  useEffect(() => { form.reset(toForm(invoice)); }, [invoice, form]);

  function submit(v: Values) {
    onSave({ notes: v.notes.trim() || null, footer: v.footer.trim() || null, paymentTermDays: v.paymentTermDays === "" ? null : Number(v.paymentTermDays) });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(submit)} className="space-y-3 rounded-lg border bg-card p-4">
        <h3 className="text-sm font-semibold">{isQuote ? "Opmerkingen en geldigheid" : "Opmerkingen en betaling"}</h3>
        <FormField control={form.control} name="notes" render={({ field }) => (
          <FormItem>
            <FormLabel>Opmerkingen</FormLabel>
            <FormControl><Textarea rows={3} placeholder={isQuote ? "Verschijnt op de offerte, boven het akkoord-vak" : "Verschijnt op de factuur, boven de betaalgegevens"} {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
          <FormField control={form.control} name="footer" render={({ field }) => (
            <FormItem>
              <FormLabel>Voettekst</FormLabel>
              <FormControl><Textarea rows={2} placeholder={defaultFooter || "Standaard voettekst uit de instellingen"} {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="paymentTermDays" render={({ field }) => (
            <FormItem>
              <FormLabel>{isQuote ? "Geldigheid (dagen)" : "Betalingstermijn (dagen)"}</FormLabel>
              <FormControl><Input type="number" min={1} max={365} placeholder={String(defaultTermDays)} {...field} /></FormControl>
              <FormDescription>Leeg = standaard.</FormDescription>
              <FormMessage />
            </FormItem>
          )} />
        </div>
        <Button type="submit" size="sm" disabled={isPending || !form.formState.isDirty}>Opslaan</Button>
      </form>
    </Form>
  );
}
