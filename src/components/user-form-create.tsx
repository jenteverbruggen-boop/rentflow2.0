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

export const createSchema = z.object({
  name: z.string().min(1, "Verplicht"),
  email: z.string().email("Ongeldig e-mailadres"),
  password: z.string().min(8, "Minimaal 8 tekens"),
  roleId: z.coerce.number({ error: "Kies een rol" }),
});

export type CreateUserValues = z.output<typeof createSchema>;
type CreateUserInput = z.input<typeof createSchema>;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit: (v: CreateUserValues) => void;
  isPending: boolean;
}

/** "New user" dialog, extracted from user-form.tsx (N1.5) — pure move plus
 * the role -> roleId switch. */
export function UserFormCreate({ open, onOpenChange, onSubmit, isPending }: Props) {
  const form = useForm<CreateUserInput, unknown, CreateUserValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { name: "", email: "", password: "", roleId: undefined },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Nieuwe gebruiker</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Naam *</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>E-mail *</FormLabel>
                  <FormControl>
                    <Input type="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Wachtwoord *</FormLabel>
                  <FormControl>
                    <Input type="password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
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
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Annuleren
              </Button>
              <Button type="submit" disabled={isPending}>
                Aanmaken
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
