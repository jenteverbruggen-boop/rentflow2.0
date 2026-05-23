"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import type { Project, ProjectStatus } from "@/types";

const STATUS_OPTIONS: ProjectStatus[] = [
  "concept",
  "bevestigd",
  "actief",
  "afgerond",
  "geannuleerd",
];

const schema = z.object({
  name: z.string().min(1, "Naam is verplicht"),
  client: z.string().optional(),
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
    defaultValues: {
      name: "", client: "", location: "", startDate: "", endDate: "", status: "concept", notes: "",
    },
  });

  useEffect(() => {
    if (defaultValues) {
      form.reset({
        name: defaultValues.name,
        client: defaultValues.client ?? "",
        location: defaultValues.location ?? "",
        startDate: defaultValues.startDate.slice(0, 10),
        endDate: defaultValues.endDate.slice(0, 10),
        status: defaultValues.status,
        notes: defaultValues.notes ?? "",
      });
    } else {
      form.reset({ name: "", client: "", location: "", startDate: "", endDate: "", status: "concept", notes: "" });
    }
  }, [defaultValues, form]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{defaultValues ? "Project bewerken" : "Nieuw project"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {(["name", "client", "location"] as const).map((field) => (
              <FormField
                key={field}
                control={form.control}
                name={field}
                render={({ field: f }) => (
                  <FormItem>
                    <FormLabel>
                      {field === "name" ? "Projectnaam *" : field === "client" ? "Klant" : "Locatie"}
                    </FormLabel>
                    <FormControl><Input {...f} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ))}

            <div className="grid grid-cols-2 gap-3">
              {(["startDate", "endDate"] as const).map((field) => (
                <FormField
                  key={field}
                  control={form.control}
                  name={field}
                  render={({ field: f }) => (
                    <FormItem>
                      <FormLabel>{field === "startDate" ? "Startdatum *" : "Einddatum *"}</FormLabel>
                      <FormControl><Input type="date" {...f} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}
            </div>

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {STATUS_OPTIONS.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notities</FormLabel>
                  <FormControl><Textarea rows={3} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
