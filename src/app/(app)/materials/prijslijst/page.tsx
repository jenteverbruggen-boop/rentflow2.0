"use client";

import { useState } from "react";
import { PrintLayout } from "@/components/print/print-layout";
import { DocumentHeader } from "@/components/print/document-header";
import { PriceListDocument } from "@/components/price-list-document";
import { PriceListOptionsPanel } from "@/components/price-list-options";
import { useAuthMe } from "@/hooks/use-auth-me";
import { usePriceList } from "@/hooks/use-price-list";
import { useSettings } from "@/hooks/use-settings";
import { DEFAULT_PRICE_LIST_OPTIONS, type PriceListOptions } from "@/lib/price-list";
import { canSeeMoney, hasAccess } from "@/lib/me-access";

/** C6 — a printable (or Excel) price list for customers. The options panel is
 * screen-only; printing shows the header and the list. */
export default function PriceListPage() {
  const [options, setOptions] = useState<PriceListOptions>(DEFAULT_PRICE_LIST_OPTIONS);
  const { data: me, isLoading: meLoading } = useAuthMe();
  const { data: settings, isLoading: settingsLoading } = useSettings();
  const allowed = canSeeMoney(me);
  const { data: list, isLoading, isError } = usePriceList(options, allowed);

  if (meLoading) return <p className="p-6 text-muted-foreground">Laden...</p>;
  if (!allowed) return <p className="p-6 text-muted-foreground">Je hebt geen toegang tot prijzen.</p>;

  return (
    <PrintLayout ready={!!list && !settingsLoading}>
      <div className="p-6 space-y-6">
        <PriceListOptionsPanel
          value={options}
          onChange={setOptions}
          canCrew={hasAccess(me, "personen")}
          canClients={hasAccess(me, "klanten")}
        />
        <DocumentHeader company={settings} meta={{}} />
        {isLoading && <p className="text-muted-foreground">Laden...</p>}
        {isError && <p className="text-destructive">Prijslijst ophalen mislukt.</p>}
        {list && <PriceListDocument list={list} />}
      </div>
    </PrintLayout>
  );
}
