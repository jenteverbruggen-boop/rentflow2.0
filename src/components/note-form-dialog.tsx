"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/date-input";
import { NoteLinkPicker } from "@/components/note-link-picker";
import type { Note } from "@/types";
import type { NoteFormValues } from "@/hooks/use-notes";

const schema = z.object({
  title: z.string().min(1, "Titel is verplicht"),
  body: z.string().min(1, "Inhoud is verplicht"),
  noteDate: z.string().min(1, "Datum is verplicht"),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultValues?: Note | null;
  initialProjectId?: number | null;
  onSubmit: (values: NoteFormValues) => void;
  isPending: boolean;
}

export function NoteFormDialog({ open, onOpenChange, defaultValues, initialProjectId, onSubmit, isPending }: Props) {
  const [projectId, setProjectId] = useState<number | null>(null);
  const [clientId, setClientId] = useState<number | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { title: "", body: "", noteDate: format(new Date(), "yyyy-MM-dd") },
  });

  useEffect(() => {
    if (!open) return;
    if (defaultValues) {
      form.reset({
        title: defaultValues.title,
        body: defaultValues.body,
        noteDate: format(new Date(defaultValues.noteDate), "yyyy-MM-dd"),
      });
      setProjectId(defaultValues.projectId);
      setClientId(defaultValues.clientId);
    } else {
      form.reset({ title: "", body: "", noteDate: format(new Date(), "yyyy-MM-dd") });
      setProjectId(initialProjectId ?? null);
      setClientId(null);
    }
  }, [defaultValues, initialProjectId, open, form]);

  function submit(values: FormValues) {
    onSubmit({ ...values, projectId, clientId });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{defaultValues ? "Notitie bewerken" : "Nieuwe notitie"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(submit)} className="space-y-3">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Titel *</FormLabel>
                  <FormControl><Input {...field} placeholder="bv. Telefoongesprek met klant" /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="noteDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Datum *</FormLabel>
                  <FormControl><DateInput type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="body"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Inhoud *</FormLabel>
                  <FormControl><Textarea rows={5} {...field} placeholder="Wat is er besproken?" /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="space-y-2">
              <Label>Koppelen aan</Label>
              <NoteLinkPicker
                projectId={projectId}
                clientId={clientId}
                onChange={({ projectId: p, clientId: c }) => { setProjectId(p); setClientId(c); }}
              />
            </div>
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
