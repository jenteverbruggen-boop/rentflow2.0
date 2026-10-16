"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { AddLinePricedFields } from "@/components/add-invoice-line-fields";
import { EMPTY, NO_SECTION, addLineSchema, type AddLineFormValues } from "@/components/add-invoice-line-schema";
import type { NewLineValues } from "@/hooks/use-invoice";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  sections: string[];
  defaultVatRate: number;
  isPending: boolean;
  error?: string;
  onSubmit: (values: NewLineValues) => void;
}

/** C8 — add a free line to a draft: a priced item/cost ("Kost", a negative
 * price makes it a discount) or a plain paragraph for extra agreements
 * ("Tekst", no amounts). */
export function AddInvoiceLineDialog({ open, onOpenChange, sections, defaultVatRate, isPending, error, onSubmit }: Props) {
  const form = useForm<AddLineFormValues>({ resolver: zodResolver(addLineSchema), defaultValues: EMPTY });
  const [wasOpen, setWasOpen] = useState(false);
  const kind = form.watch("kind");

  useEffect(() => {
    if (open && !wasOpen) form.reset({ ...EMPTY, vatRate: String(defaultVatRate) });
    setWasOpen(open);
  }, [open, wasOpen, defaultVatRate, form]);

  function submit(v: AddLineFormValues) {
    const section = v.section === NO_SECTION ? null : v.section;
    onSubmit(
      v.kind === "text"
        ? { kind: "text", description: v.description, section }
        : {
            kind: "manual", description: v.description, quantity: Number(v.quantity), unit: v.unit,
            unitPrice: Number(v.unitPrice), vatRate: Number(v.vatRate), section,
          },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader><DialogTitle>Regel toevoegen</DialogTitle></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
            <div className="flex gap-2">
              <Button type="button" size="sm" variant={kind === "manual" ? "default" : "outline"} onClick={() => form.setValue("kind", "manual")}>
                Kost / item
              </Button>
              <Button type="button" size="sm" variant={kind === "text" ? "default" : "outline"} onClick={() => form.setValue("kind", "text")}>
                Tekst
              </Button>
            </div>
            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem>
                <FormLabel>{kind === "text" ? "Tekst *" : "Omschrijving *"}</FormLabel>
                <FormControl>
                  {kind === "text"
                    ? <Textarea rows={4} placeholder="Bv. extra afspraken, betalingsvoorwaarden, opmerkingen…" {...field} />
                    : <Input {...field} />}
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            {kind === "manual" && <AddLinePricedFields form={form} defaultVatRate={defaultVatRate} />}
            {sections.length > 0 && (
              <FormField control={form.control} name="section" render={({ field }) => (
                <FormItem>
                  <FormLabel>Onder periode</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value={NO_SECTION}>Onderaan (geen periode)</SelectItem>
                      {sections.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
            )}
            {error && <p className="text-xs text-destructive">{error}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuleren</Button>
              <Button type="submit" disabled={isPending}>Toevoegen</Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
