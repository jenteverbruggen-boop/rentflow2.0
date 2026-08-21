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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RoleSelect } from "@/components/role-select";
import { PersonLinkSelect } from "@/components/person-link-select";
import type { User } from "@/types";

export const editSchema = z.object({
  roleId: z.coerce.number({ error: "Kies een rol" }),
  personId: z.number().nullable(),
  password: z.string().refine((v) => v === "" || v.length >= 8, {
    message: "Minimaal 8 tekens of leeg laten",
  }),
});

export type EditUserValues = z.output<typeof editSchema>;
type EditUserInput = z.input<typeof editSchema>;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultValues: User;
  onSubmit: (v: EditUserValues) => void;
  isPending: boolean;
}

/** "Edit user" dialog, extracted from user-form.tsx (N1.5) — pure move
 * plus the role -> roleId switch. */
export function UserFormEdit({
  open,
  onOpenChange,
  defaultValues,
  onSubmit,
  isPending,
}: Props) {
  const form = useForm<EditUserInput, unknown, EditUserValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      roleId: defaultValues.roleId ?? undefined,
      personId: defaultValues.personId,
      password: "",
    },
  });

  useEffect(() => {
    form.reset({
      roleId: defaultValues.roleId ?? undefined,
      personId: defaultValues.personId,
      password: "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultValues.id]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Gebruiker bewerken</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="roleId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Rol</FormLabel>
                  <FormControl>
                    <RoleSelect
                      value={field.value as number | undefined}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="personId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Gekoppelde persoon</FormLabel>
                  <FormControl>
                    <PersonLinkSelect value={field.value} onChange={field.onChange} />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    Nodig voor rollen die enkel eigen projecten mogen zien.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nieuw wachtwoord (optioneel)</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="Leeg = ongewijzigd" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Annuleren
              </Button>
              <Button type="submit" disabled={isPending}>
                Opslaan
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
