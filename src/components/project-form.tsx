"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { EntityCombobox } from "@/components/entity-combobox";
import type { Client, Project, ProjectStatus } from "@/types";

const STATUS_OPTIONS: ProjectStatus[] = ["concept", "bevestigd", "actief", "afgerond", "geannuleerd"];

const schema = z.object({
  name: z.string().min(1, "Naam is verplicht"),
  clientId: z.number().optional().nullable(),
  location: z.string().optional(),
  startDate: z.string().min(1, "Startdatum is verplicht"),
  endDate: z.string().min(1, "Einddatum is verplicht"),
  status: z.enum(["concept", "bevestigd", "actief", "afgerond", "geannuleerd"]),
  notes: z.string().optional(),
});

export type ProjectFormValues = z.infer<typeof schema>;

interface ProjectFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultValues?: Project | null;
  onSubmit: (values: ProjectFormValues) => void;
  isPending: boolean;
}

export function ProjectForm({ open, onOpenChange, defaultValues, onSubmit, isPending }: ProjectFormProps) {
  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", clientId: null, location: "", startDate: "", endDate: "", status: "concept", notes: "" },
  });
  const [clientId, setClientId] = useState<number | null>(null);

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["clients"],
    queryFn: () => fetch("/api/clients").then((r) => r.json()),
  });

  useEffect(() => {
    if (defaultValues) {
      setClientId(defaultValues.clientId ?? null);
      form.reset({
        name: defaultValues.name,
        clientId: defaultValues.clientId ?? null,
        location: defaultValues.location ?? "",
        startDate: defaultValues.startDate.slice(0, 10),
        endDate: defaultValues.endDate.slice(0, 10),
        status: defaultValues.status,
        notes: defaultValues.notes ?? "",
      });
    } else {
      setClientId(null);
      form.reset({ name: "", clientId: null, location: "", startDate: "", endDate: "", status: "concept", notes: "" });
    }
  }, [defaultValues, form]);

  async function createClient(name: string) {
    const res = await fetch("/api/clients", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
    return res.json() as Promise<{ id: number }>;
  }

  function handleSubmit(values: ProjectFormValues) {
    const selectedClient = clients.find((c) => c.id === clientId);
    onSubmit({ ...values, clientId, client: selectedClient?.name ?? values.location } as ProjectFormValues & { client?: string });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{defaultValues ? "Project bewerken" : "Nieuw project"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem><FormLabel>Projectnaam *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormItem>
              <FormLabel>Klant</FormLabel>
              <EntityCombobox items={clients} value={clientId} onChange={(id) => { setClientId(id); form.setValue("clientId", id); }}
                onCreate={createClient} placeholder="Selecteer klant..." createLabel="+ Nieuwe klant aanmaken" />
            </FormItem>
            <FormField control={form.control} name="location" render={({ field }) => (
              <FormItem><FormLabel>Locatie</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
            )} />
            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="startDate" render={({ field }) => (
                <FormItem><FormLabel>Startdatum *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="endDate" render={({ field }) => (
                <FormItem><FormLabel>Einddatum *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>
            <FormField control={form.control} name="status" render={({ field }) => (
              <FormItem><FormLabel>Status</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>{STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </FormItem>
            )} />
            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem><FormLabel>Notities</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl></FormItem>
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
