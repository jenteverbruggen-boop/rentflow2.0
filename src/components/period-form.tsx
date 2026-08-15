"use client";

import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, endOfDay } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/date-input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { Period, Project } from "@/types";

const schema = z.object({
  name: z.string().min(1, "Naam is verplicht"),
  startDate: z.string().min(1, "Verplicht"),
  endDate: z.string().min(1, "Verplicht"),
}).refine((v) => new Date(v.endDate) > new Date(v.startDate), {
  // Strict > (H4.3, matching the server): a zero-duration period is
  // nonsensical for booking and inconsistent with availability's own
  // strict lt/gt semantics (H3). Was >= before this change.
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

function toDateTimeLocal(iso: string): string {
  return format(new Date(iso), "yyyy-MM-dd'T'HH:mm");
}

export function PeriodForm({ open, onOpenChange, defaultValues, project, onSubmit, isPending }: Props) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      startDate: toDateTimeLocal(project.startDate),
      endDate: toDateTimeLocal(project.endDate),
    },
  });

  useEffect(() => {
    if (defaultValues) {
      form.reset({
        name: defaultValues.name,
        startDate: toDateTimeLocal(defaultValues.startDate),
        endDate: toDateTimeLocal(defaultValues.endDate),
      });
    } else {
      // A new period defaults to a single day (the project's start date),
      // not the full project span — defaulting to the whole range is what
      // actually books a person solid for the entire project (H4).
      form.reset({
        name: "",
        startDate: format(new Date(project.startDate), "yyyy-MM-dd") + "T08:00",
        endDate: format(new Date(project.startDate), "yyyy-MM-dd") + "T17:00",
      });
    }
  }, [defaultValues, project, form]);

  const start = useWatch({ control: form.control, name: "startDate" });
  const end = useWatch({ control: form.control, name: "endDate" });
  const outOfRange =
    start && end &&
    (new Date(start) < new Date(project.startDate) ||
      new Date(end) > endOfDay(new Date(project.endDate)));

  function handleSubmit(values: FormValues) {
    onSubmit({
      ...values,
      startDate: new Date(values.startDate).toISOString(),
      endDate: new Date(values.endDate).toISOString(),
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{defaultValues ? "Periode bewerken" : "Nieuwe periode"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem><FormLabel>Naam *</FormLabel><FormControl><Input placeholder="bv. Voorbereiding" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="startDate" render={({ field }) => (
                <FormItem><FormLabel>Van *</FormLabel><FormControl><DateInput type="datetime-local" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="endDate" render={({ field }) => (
                <FormItem><FormLabel>Tot *</FormLabel><FormControl><DateInput type="datetime-local" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>
            {outOfRange && (
              <Alert>
                <AlertDescription className="text-amber-600">
                  ⚠ Deze periode valt buiten de projectperiode
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
