"use client";

import type { UseFormReturn } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { vatOptions } from "@/lib/invoice-vat-options";
import type { AddLineFormValues } from "@/components/add-invoice-line-schema";

/** The amount fields of a priced free line (quantity, unit, price, VAT). */
export function AddLinePricedFields({ form, defaultVatRate }: { form: UseFormReturn<AddLineFormValues>; defaultVatRate: number }) {
  const vat = Number(form.watch("vatRate"));
  return (
    <div className="grid grid-cols-3 gap-3">
      <FormField control={form.control} name="quantity" render={({ field }) => (
        <FormItem><FormLabel>Aantal</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
      )} />
      <FormField control={form.control} name="unit" render={({ field }) => (
        <FormItem>
          <FormLabel>Eenheid</FormLabel>
          <Select value={field.value} onValueChange={field.onChange}>
            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
            <SelectContent>
              <SelectItem value="stuk">stuk</SelectItem>
              <SelectItem value="dag">dag</SelectItem>
              <SelectItem value="uur">uur</SelectItem>
            </SelectContent>
          </Select>
        </FormItem>
      )} />
      <FormField control={form.control} name="unitPrice" render={({ field }) => (
        <FormItem><FormLabel>Prijs (€)</FormLabel><FormControl><Input type="number" step="0.01" placeholder="-50 = korting" {...field} /></FormControl><FormMessage /></FormItem>
      )} />
      <FormField control={form.control} name="vatRate" render={({ field }) => (
        <FormItem className="col-span-3 sm:col-span-1">
          <FormLabel>BTW</FormLabel>
          <Select value={field.value} onValueChange={field.onChange}>
            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
            <SelectContent>
              {vatOptions(defaultVatRate).map((r) => <SelectItem key={r} value={String(r)}>{r}%</SelectItem>)}
            </SelectContent>
          </Select>
        </FormItem>
      )} />
      {vat === 0 && (
        <p className="col-span-3 text-xs text-muted-foreground">
          Bij 0% BTW hoort een wettelijke vermelding (bv. “BTW verlegd”). Voeg die toe als tekstregel.
        </p>
      )}
    </div>
  );
}
