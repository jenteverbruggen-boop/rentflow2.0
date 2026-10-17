"use client";

import { useEffect, useRef } from "react";
import { useAuthMe } from "@/hooks/use-auth-me";
import { applyTheme, currentDomTheme, useSaveTheme } from "@/hooks/use-theme-preference";

/**
 * Always mounted in the (app) layout: applies the account's saved theme
 * whenever the account loads, so the look follows the user to every device
 * and survives logging out and in — independent of whether the theme picker
 * on the profile page is on screen. An account that never chose (null) adopts
 * this browser's current look instead, so nobody is flipped to a default.
 */
export function AccountThemeSync() {
  const { data: me } = useAuthMe();
  const save = useSaveTheme();
  const loaded = me !== undefined;
  const saved = me?.theme;
  const seeded = useRef(false);

  useEffect(() => {
    if (!loaded) return;
    if (saved) {
      applyTheme(saved);
    } else if (!seeded.current) {
      seeded.current = true;
      void save(currentDomTheme());
    }
  }, [loaded, saved, save]);

  return null;
}
