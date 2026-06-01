"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { Period, Project } from "@/types";

const schema = z.object({
  name: z.string().min(1, "Naam is verplicht"),
  startDate: z.string().min(1, "Verplicht"),
  endDate: z.string().min(1, "Verplicht"),
}).refine((v) => new Date(v.endDate) >= new Date(v.startDate), {
  message: "Einddatum moet na startdatum liggen",
  path: ["endDate"],
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultValues?: Period | null;
  project: Project;
  onSubmit: (values: FormValues) => void;
  isPending: boolean;
}

function toDateInput(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

export function PeriodForm({ open, onOpenChange, defaultValues, project, onSubmit, isPending }: Props) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", startDate: toDateInput(project.startDate), endDate: toDateInput(project.endDate) },
  });

  useEffect(() => {
    if (defaultValues) {
      form.reset({
        name: defaultValues.name,
        startDate: toDateInput(defaultValues.startDate),
        endDate: toDateInput(defaultValues.endDate),
      });
    } else {
      form.reset({ name: "", startDate: toDateInput(project.startDate), endDate: toDateInput(project.endDate) });
    }
  }, [defaultValues, project, form]);

  const start = form.watch("startDate");
  const end = form.watch("endDate");
  const outOfRange =
    start && end &&
    (new Date(start) < new Date(project.startDate) || new Date(end) > new Date(project.endDate));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{defaultValues ? "Periode bewerken" : "Nieuwe periode"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem><FormLabel>Naam *</FormLabel><FormControl><Input placeholder="bv. Voorbereiding" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="startDate" render={({ field }) => (
                <FormItem><FormLabel>Van *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="endDate" render={({ field }) => (
                <FormItem><FormLabel>Tot *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>
            {outOfRange && (
              <Alert>
                <AlertDescription className="text-amber-600">
                  ⚠ Deze periode valt buiten de projectperiode ({toDateInput(project.startDate)} – {toDateInput(project.endDate)})
                </AlertDescription>
              </Alert>
            )}
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
