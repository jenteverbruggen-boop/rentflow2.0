"use client";

import { useState } from "react";
import { type Resolver, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { PriceBasisSelect } from "@/components/price-basis-select";
import { useAuthMe } from "@/hooks/use-auth-me";
import { useSuppliers } from "@/hooks/use-suppliers";
import { useAdhocSubhire, NameTakenError } from "@/hooks/use-adhoc-subhire";
import { canWriteMoney } from "@/lib/me-access";
import type { PriceBasis, SubhireCostBasis } from "@/types";

const schema = z.object({
  name: z.string().trim().min(1, "Naam is verplicht"),
  supplierId: z.string().min(1, "Kies een leverancier"),
  quantity: z.coerce.number().int().min(1, "Minstens 1"),
  dayPrice: z.coerce.number().min(0, "Moet ≥ 0 zijn").optional(),
  unitCost: z.union([z.literal(""), z.coerce.number().min(0, "Moet ≥ 0 zijn")]).optional(),
});
type FormValues = z.infer<typeof schema>;

interface Props {
  periodId: number;
  projectId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The name already exists: book that item instead. */
  onUseExisting: (materialId: number, quantity: number) => void;
}

/** "+ Inhuur-item": one-off item that is hired in from a supplier — creates an
 * inhuur-only catalogue item and books it in this period in one go. */
export function AdhocSubhireDialog({ periodId, projectId, open, onOpenChange, onUseExisting }: Props) {
  const { data: me } = useAuthMe();
  const money = canWriteMoney(me);
  const suppliers = useSuppliers(false, open).query.data ?? [];
  const mutation = useAdhocSubhire(periodId, projectId);
  const [priceBasis, setPriceBasis] = useState<PriceBasis>("per_huur");
  const [costBasis, setCostBasis] = useState<SubhireCostBasis>("per_huur");
  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: { name: "", supplierId: "", quantity: 1, dayPrice: 0, unitCost: "" },
  });
  const taken = mutation.error instanceof NameTakenError ? mutation.error : null;

  function submit(v: FormValues) {
    mutation.mutate(
      {
        name: v.name, supplierId: Number(v.supplierId), quantity: v.quantity,
        ...(money ? { dayPrice: v.dayPrice ?? 0, priceBasis, unitCost: v.unitCost === "" || v.unitCost == null ? null : Number(v.unitCost), costBasis } : {}),
      },
      { onSuccess: () => { form.reset(); mutation.reset(); onOpenChange(false); } },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" aria-describedby={undefined}>
        <DialogHeader><DialogTitle>Inhuur-item toevoegen</DialogTitle></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(submit)} className="space-y-3">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem><FormLabel>Naam *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="supplierId" render={({ field }) => (
              <FormItem>
                <FormLabel>Leverancier *</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Kies een leverancier" /></SelectTrigger></FormControl>
                  <SelectContent>{suppliers.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="quantity" render={({ field }) => (
              <FormItem><FormLabel>Aantal *</FormLabel><FormControl><Input type="number" min={1} {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            {money && (
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="dayPrice" render={({ field }) => (
                  <FormItem><FormLabel>Verkoopprijs (€)</FormLabel><FormControl><Input type="number" step="0.01" min={0} {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <div className="space-y-2"><Label>Verkoop per</Label><PriceBasisSelect value={priceBasis} onChange={setPriceBasis} /></div>
                <FormField control={form.control} name="unitCost" render={({ field }) => (
                  <FormItem><FormLabel>Inkoopprijs (€)</FormLabel><FormControl><Input type="number" step="0.01" min={0} {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>
                )} />
                <div className="space-y-2">
                  <Label>Inkoop per</Label>
                  <Select value={costBasis} onValueChange={(v) => setCostBasis(v as SubhireCostBasis)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="per_huur">per huur (eenmalig)</SelectItem>
                      <SelectItem value="per_dag">per dag</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            {!money && <p className="text-xs text-muted-foreground">Prijzen kan je later invullen op de materiaalpagina; tot dan wordt het aan €0 gefactureerd.</p>}
            {mutation.isError && (
              <p className="text-sm text-destructive" role="alert">
                {mutation.error.message}
                {taken && (
                  <> <button type="button" className="underline" onClick={() => { onUseExisting(taken.materialId, Number(form.getValues("quantity")) || 1); mutation.reset(); onOpenChange(false); }}>Bestaand item gebruiken</button></>
                )}
              </p>
            )}
            <div className="flex gap-3 pt-1">
              <Button type="submit" className="flex-1" disabled={mutation.isPending}>{mutation.isPending ? "Bezig..." : "Toevoegen en inhuren"}</Button>
              <Button type="button" variant="secondary" className="flex-1" onClick={() => onOpenChange(false)}>Annuleren</Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
