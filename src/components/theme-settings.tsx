"use client";

import { useState } from "react";
import { Moon, Sun, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useThemePreference } from "@/hooks/use-theme-preference";
import type { Theme } from "@/lib/theme";

const OPTIONS: { value: Theme; label: string; icon: LucideIcon }[] = [
  { value: "light", label: "Licht", icon: Sun },
  { value: "dark", label: "Donker", icon: Moon },
];

type Status = "idle" | "saving" | "saved" | "error";

const STATUS_TEXT: Record<Status, string> = {
  idle: "Je keuze wordt op je account bewaard en geldt op elk apparaat.",
  saving: "Opslaan…",
  saved: "Opgeslagen op je account.",
  error: "Opslaan mislukt. Probeer het opnieuw.",
};

/** Profile-page "Weergave" card: pick light or dark, saved on the account. */
export function ThemeSettings() {
  const { theme, setTheme } = useThemePreference();
  const [status, setStatus] = useState<Status>("idle");

  async function choose(next: Theme) {
    if (next === theme) return;
    setStatus("saving");
    setStatus((await setTheme(next)) ? "saved" : "error");
  }

  return (
    <section className="space-y-3 rounded-lg border border-border p-4">
      <h3 className="font-semibold">Weergave</h3>
      <div role="radiogroup" aria-label="Thema" className="flex gap-2">
        {OPTIONS.map(({ value, label, icon: Icon }) => {
          const selected = theme === value;
          return (
            <Button
              key={value}
              type="button"
              role="radio"
              aria-checked={selected}
              variant={selected ? "default" : "outline"}
              onClick={() => choose(value)}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Button>
          );
        })}
      </div>
      <p
        aria-live="polite"
        className={status === "error" ? "text-sm text-destructive" : "text-sm text-muted-foreground"}
      >
        {STATUS_TEXT[status]}
      </p>
    </section>
  );
}
