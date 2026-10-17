"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

const schema = z
  .object({
    currentPassword: z.string().min(1, "Verplicht"),
    newPassword: z.string().min(8, "Minimaal 8 tekens"),
    confirm: z.string(),
  })
  .refine((v) => v.newPassword === v.confirm, {
    message: "Wachtwoorden komen niet overeen",
    path: ["confirm"],
  });
type Values = z.infer<typeof schema>;

async function post(url: string, body?: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? "Er ging iets mis");
  }
}

export function AccountSecurity() {
  const [notice, setNotice] = useState<string | null>(null);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: "", newPassword: "", confirm: "" },
  });

  const change = useMutation({
    mutationFn: (v: Values) =>
      post("/api/auth/password", {
        currentPassword: v.currentPassword,
        newPassword: v.newPassword,
      }),
    onSuccess: () => {
      form.reset();
      setNotice("Wachtwoord gewijzigd. Je andere apparaten zijn uitgelogd.");
    },
  });
  const logoutAll = useMutation({
    mutationFn: () => post("/api/auth/logout-all"),
    onSuccess: () => setNotice("Alle andere apparaten zijn uitgelogd."),
  });
  const error = change.error ?? logoutAll.error;

  const field = (name: keyof Values, label: string) => (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input type="password" autoComplete={name === "currentPassword" ? "current-password" : "new-password"} {...field} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );

  return (
    <section className="space-y-4 rounded-lg border border-border p-4">
      <h3 className="font-semibold">Beveiliging</h3>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit((v) => {
            setNotice(null);
            change.mutate(v);
          })}
          className="space-y-3 max-w-sm"
        >
          {field("currentPassword", "Huidig wachtwoord")}
          {field("newPassword", "Nieuw wachtwoord")}
          {field("confirm", "Bevestig nieuw wachtwoord")}
          <Button type="submit" disabled={change.isPending}>Wachtwoord wijzigen</Button>
        </form>
      </Form>
      <div className="border-t border-border pt-4">
        <Button
          variant="outline"
          disabled={logoutAll.isPending}
          onClick={() => {
            setNotice(null);
            logoutAll.mutate();
          }}
        >
          Overal uitloggen
        </Button>
        <p className="mt-2 text-sm text-muted-foreground">
          Logt alle andere apparaten en browsers uit; dit apparaat blijft ingelogd.
        </p>
      </div>
      {error && (
        <Alert variant="destructive"><AlertDescription>{error.message}</AlertDescription></Alert>
      )}
      {notice && <Alert><AlertDescription>{notice}</AlertDescription></Alert>}
    </section>
  );
}
