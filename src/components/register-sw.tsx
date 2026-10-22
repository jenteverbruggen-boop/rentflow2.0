"use client";

import { useEffect } from "react";

/** Registers /sw.js (required for the Android WebAPK install). */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch((err) => console.warn("[sw] registration failed", err));
  }, []);
  return null;
}
