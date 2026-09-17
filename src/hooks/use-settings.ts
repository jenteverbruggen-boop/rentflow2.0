import { useQuery } from "@tanstack/react-query";

/**
 * B1 — company/invoice settings, shared by the settings form and every
 * print document (invoice/pakbon/callsheet/kosten). All values are
 * plain strings (the setting store is a flat key/value table), so
 * there is no Decimal/money conversion concern here.
 */
export type Settings = Record<string, string>;

export function useSettings() {
  return useQuery<Settings>({
    queryKey: ["settings"],
    queryFn: () => fetch("/api/settings").then((r) => r.json()),
  });
}
