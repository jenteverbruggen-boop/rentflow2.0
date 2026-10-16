import { useQuery } from "@tanstack/react-query";
import type { LoadedPriceList } from "@/lib/price-list-load";
import type { PriceListOptions } from "@/lib/price-list";

/** The query string both the page and the xlsx download use. */
export function priceListQueryString(o: PriceListOptions): string {
  const p = new URLSearchParams();
  if (o.categoryIds) p.set("categories", o.categoryIds.join(","));
  p.set("sets", o.includeSets ? "1" : "0");
  p.set("crew", o.includeCrew ? "1" : "0");
  p.set("hideZero", o.hideZero ? "1" : "0");
  if (o.clientId != null) p.set("client", String(o.clientId));
  p.set("vat", o.vat);
  return p.toString();
}

export function usePriceList(options: PriceListOptions, enabled: boolean) {
  const qs = priceListQueryString(options);
  return useQuery<LoadedPriceList>({
    queryKey: ["price-list", qs],
    enabled,
    queryFn: async () => {
      const res = await fetch(`/api/price-list?${qs}`);
      if (!res.ok) throw new Error("Prijslijst ophalen mislukt");
      return res.json();
    },
  });
}
