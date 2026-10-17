"use client";

import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthMe, type AuthMe } from "@/hooks/use-auth-me";
import type { Theme } from "@/lib/theme";

/** Paints the theme now and remembers it in this browser, so the pre-paint
 * script in layout.tsx can apply it before the next load flashes. */
export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  try {
    localStorage.setItem("theme", theme);
  } catch {
    // ignore storage errors (private mode etc.)
  }
}

export function currentDomTheme(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

/**
 * Saves a theme on the account (`PATCH /api/auth/me`). The cached account is
 * updated first, or `AccountThemeSync` would flip the page back to the old
 * value. Resolves `true` once the server stored it.
 */
export function useSaveTheme() {
  const queryClient = useQueryClient();
  return useCallback(
    async (next: Theme): Promise<boolean> => {
      queryClient.setQueryData<AuthMe>(["auth-me"], (old) => (old ? { ...old, theme: next } : old));
      try {
        const res = await fetch("/api/auth/me", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ theme: next }),
        });
        if (res.ok) return true;
      } catch {
        // fall through to resync
      }
      queryClient.invalidateQueries({ queryKey: ["auth-me"] });
      return false;
    },
    [queryClient],
  );
}

/** The active theme plus a setter that paints and saves it in one go. */
export function useThemePreference() {
  const { data: me } = useAuthMe();
  const save = useSaveTheme();
  // null until mounted so the server render and first client render agree.
  const [domTheme, setDomTheme] = useState<Theme | null>(null);

  useEffect(() => {
    setDomTheme(currentDomTheme());
  }, []);

  const setTheme = useCallback(
    (next: Theme) => {
      applyTheme(next);
      setDomTheme(next);
      return save(next);
    },
    [save],
  );

  return { theme: me?.theme ?? domTheme, setTheme };
}
