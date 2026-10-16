"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthMe, type AuthMe } from "@/hooks/use-auth-me";
import type { Theme } from "@/lib/theme";

interface ThemeToggleProps {
  iconOnly?: boolean;
  className?: string;
}

/** Paints the theme now and remembers it in this browser, so the pre-paint
 * script in layout.tsx can apply it before the next load flashes. */
function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  try {
    localStorage.setItem("theme", theme);
  } catch {
    // ignore storage errors (private mode etc.)
  }
}

/**
 * Light/dark switch. The choice is saved on the account (`PATCH /api/auth/me`),
 * and the account's saved theme is applied whenever it loads — so the look
 * follows the user to every device and survives logging out and in. The
 * localStorage copy is only there to avoid a flash before that load finishes.
 */
export function ThemeToggle({ iconOnly = false, className }: ThemeToggleProps) {
  const queryClient = useQueryClient();
  const { data: me } = useAuthMe();
  // Start false so the server render and first client render agree (the actual
  // theme is read after mount to avoid a hydration mismatch).
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  // The account's saved theme wins over whatever this browser remembered.
  const saved = me?.theme;
  useEffect(() => {
    if (!saved) return;
    applyTheme(saved);
    setIsDark(saved === "dark");
  }, [saved]);

  function toggle() {
    const next: Theme = isDark ? "light" : "dark";
    applyTheme(next);
    setIsDark(next === "dark");
    // Update the cached account first, or the effect above would flip it back.
    queryClient.setQueryData<AuthMe>(["auth-me"], (old) => (old ? { ...old, theme: next } : old));
    fetch("/api/auth/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme: next }),
    }).then((res) => {
      if (!res.ok) queryClient.invalidateQueries({ queryKey: ["auth-me"] });
    }).catch(() => queryClient.invalidateQueries({ queryKey: ["auth-me"] }));
  }

  return (
    <Button
      variant="ghost"
      size={iconOnly ? "icon" : "sm"}
      onClick={toggle}
      className={className}
      aria-label="Thema wisselen"
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      {!iconOnly && (
        <span className="ml-2">{isDark ? "Lichte modus" : "Donkere modus"}</span>
      )}
    </Button>
  );
}
