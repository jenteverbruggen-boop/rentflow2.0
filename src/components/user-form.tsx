"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { User } from "@/types";

const createSchema = z.object({
  name: z.string().min(1, "Verplicht"),
  email: z.string().email("Ongeldig e-mailadres"),
  password: z.string().min(8, "Minimaal 8 tekens"),
  role: z.string().min(1, "Verplicht"),
});

const editSchema = z.object({
  role: z.string().min(1, "Verplicht"),
  password: z.string().refine((v) => v === "" || v.length >= 8, {
    message: "Minimaal 8 tekens of leeg laten",
  }),
});

export type CreateUserValues = z.infer<typeof createSchema>;
export type EditUserValues = z.infer<typeof editSchema>;

function RoleSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Select onValueChange={onChange} value={value}>
      <SelectTrigger><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="user">User</SelectItem>
        <SelectItem value="admin">Admin</SelectItem>
      </SelectContent>
    </Select>
  );
}

interface BaseProps { open: boolean; onOpenChange: (v: boolean) => void; isPending: boolean; }
interface CreateProps extends BaseProps { mode: "create"; onSubmit: (v: CreateUserValues) => void; }
interface EditProps extends BaseProps { mode: "edit"; defaultValues: User; onSubmit: (v: EditUserValues) => void; }
type Props = CreateProps | EditProps;

export function UserForm(props: Props) {
  const createForm = useForm<CreateUserValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { name: "", email: "", password: "", role: "user" },
  });
  const editForm = useForm<EditUserValues>({
    resolver: zodResolver(editSchema),
    defaultValues: { role: "user", password: "" },
  });

  useEffect(() => {
    if (props.mode === "edit") {
      editForm.reset({ role: props.defaultValues.role, password: "" });
    } else {
      createForm.reset({ name: "", email: "", password: "", role: "user" });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.open]);

  const cancel = <Button type="button" variant="outline" onClick={() => props.onOpenChange(false)}>Annuleren</Button>;

  if (props.mode === "edit") {
    return (
      <Dialog open={props.open} onOpenChange={props.onOpenChange}>
        <DialogContent>
          <DialogHeader><DialogTitle>Gebruiker bewerken</DialogTitle></DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(props.onSubmit)} className="space-y-4">
              <FormField control={editForm.control} name="role" render={({ field }) => (
                <FormItem>
                  <FormLabel>Rol</FormLabel>
                  <FormControl><RoleSelect value={field.value} onChange={field.onChange} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={editForm.control} name="password" render={({ field }) => (
                <FormItem>
                  <FormLabel>Nieuw wachtwoord (optioneel)</FormLabel>
                  <FormControl><Input type="password" placeholder="Leeg = ongewijzigd" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="flex justify-end gap-2 pt-2">{cancel}<Button type="submit" disabled={props.isPending}>Opslaan</Button></div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Nieuwe gebruiker</DialogTitle></DialogHeader>
        <Form {...createForm}>
          <form onSubmit={createForm.handleSubmit(props.onSubmit)} className="space-y-4">
            <FormField control={createForm.control} name="name" render={({ field }) => (
              <FormItem><FormLabel>Naam *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={createForm.control} name="email" render={({ field }) => (
              <FormItem><FormLabel>E-mail *</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={createForm.control} name="password" render={({ field }) => (
              <FormItem><FormLabel>Wachtwoord *</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={createForm.control} name="role" render={({ field }) => (
              <FormItem>
                <FormLabel>Rol</FormLabel>
                <FormControl><RoleSelect value={field.value} onChange={field.onChange} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <div className="flex justify-end gap-2 pt-2">{cancel}<Button type="submit" disabled={props.isPending}>Aanmaken</Button></div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
