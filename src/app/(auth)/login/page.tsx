"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

type Mode = "login" | "register";

interface FormState {
  email: string;
  password: string;
  name: string;
}

async function authFetch(mode: Mode, form: FormState) {
  const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(form),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Er ging iets mis");
  return data;
}

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [form, setForm] = useState<FormState>({ email: "", password: "", name: "" });

  const { mutate, isPending, error } = useMutation({
    mutationFn: () => authFetch(mode, form),
    onSuccess: () => router.push("/"),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    mutate();
  }

  function set(field: keyof FormState) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl text-primary">RentFlow</CardTitle>
          <CardDescription>
            {mode === "login" ? "Inloggen op je account" : "Nieuw account aanmaken"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{(error as Error).message}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "register" && (
              <div className="space-y-1.5">
                <Label htmlFor="name">Naam</Label>
                <Input id="name" value={form.name} onChange={set("name")} required />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={form.email} onChange={set("email")} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Wachtwoord</Label>
              <Input id="password" type="password" value={form.password} onChange={set("password")} required />
            </div>
            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? "Bezig..." : mode === "login" ? "Inloggen" : "Registreren"}
            </Button>
          </form>

          <Button
            variant="link"
            className="mt-3 w-full text-muted-foreground text-xs"
            onClick={() => setMode(mode === "login" ? "register" : "login")}
          >
            {mode === "login"
              ? "Nog geen account? Registreer hier"
              : "Al een account? Log in"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
