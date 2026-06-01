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
import type { StockItem } from "@/types";

const schema = z.object({
  identifier: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultValues?: StockItem | null;
  onSubmit: (values: FormValues) => void;
  isPending: boolean;
}

export function StockItemForm({ open, onOpenChange, defaultValues, onSubmit, isPending }: Props) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { identifier: "", notes: "" },
  });

  useEffect(() => {
    form.reset(
      defaultValues
        ? { identifier: defaultValues.identifier ?? "", notes: defaultValues.notes ?? "" }
        : { identifier: "", notes: "" }
    );
  }, [defaultValues, form]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{defaultValues ? "Unit bewerken" : "Unit toevoegen"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="identifier" render={({ field }) => (
              <FormItem>
                <FormLabel>Identificatie (optioneel)</FormLabel>
                <FormControl><Input placeholder="bv. serienummer, barcode..." {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem>
                <FormLabel>Notities (optioneel)</FormLabel>
                <FormControl><Textarea rows={2} {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <div className="flex gap-3 pt-1">
              <Button type="submit" className="flex-1" disabled={isPending}>
                {isPending ? "Bezig..." : defaultValues ? "Opslaan" : "Toevoegen"}
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
