"use client";

import { LinePricePopover } from "@/components/line-price-popover";
import { BookingDiscountPopover } from "@/components/booking-discount-popover";
import { formatEUR } from "@/lib/pricing";
import { resolvePersonBasePrice } from "@/lib/person-base-price";
import { toNumber } from "@/lib/serialize";
import type { PeriodPerson, PersonTravelCost, Project } from "@/types";

interface PersonRowProps {
  line: PeriodPerson;
  days: number;
  cost: number;
  periodId: number;
  project: Project;
}

export function PersonCostRow({ line, days, cost, periodId, project }: PersonRowProps) {
  const pp = line;
  const override = project.personPrices.find((p) => p.personId === pp.personId);
  return (
    <tr className="border-b last:border-0">
      <td className="py-2 pl-3 pr-2 align-middle">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-secondary text-sm">👥</span>
      </td>
      <td className="py-2 pr-4 text-sm align-middle">
        <div className="font-medium leading-tight">{pp.person.name}</div>
        {pp.function?.name && (
          <div className="text-muted-foreground text-[11px] leading-tight">{pp.function.name}</div>
        )}
      </td>
      <td className="py-2 pr-4 text-xs text-muted-foreground tabular-nums whitespace-nowrap align-middle">
        {days} × {formatEUR(pp.dayPriceSnapshot)}
      </td>
      <td className="py-2 pr-3 align-middle">
        <BookingDiscountPopover
          discountPct={pp.discountPct}
          discountAmount={pp.discountAmount}
          patchUrls={[`/api/periods/${periodId}/people/${pp.id}`]}
          invalidateKey={["project", String(project.id)]}
        />
      </td>
      <td className="py-2 pr-3 text-right align-middle">
        <LinePricePopover
          snapshot={pp.dayPriceSnapshot}
          basePrice={resolvePersonBasePrice(pp)}
          override={override ? override.dayPrice : null}
          resnapshotUrl={`/api/periods/${periodId}/people/${pp.id}`}
          projectId={project.id}
          kind="person"
          entityId={pp.personId}
          entityName={pp.person.name}
          invalidateKey={["project", String(project.id)]}
        />
      </td>
      <td className="py-2 pr-3 text-right text-sm font-semibold tabular-nums align-middle">{formatEUR(cost)}</td>
    </tr>
  );
}

interface TravelCostRowProps {
  travel: PersonTravelCost;
  personName: string;
}

/** One itemised travel-cost line (J1.2) — previously only a rolled-up
 * "Reiskosten: €X" existed, with no per-entry line in the cost table. */
export function TravelCostRow({ travel, personName }: TravelCostRowProps) {
  const unitCost = toNumber(travel.unitCost);
  const cost = unitCost * travel.quantity;
  return (
    <tr className="border-b last:border-0">
      <td className="py-2 pl-3 pr-2 align-middle">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-secondary text-sm">🚗</span>
      </td>
      <td className="py-2 pr-4 text-sm align-middle">
        <div className="font-medium leading-tight">{travel.label ?? "Reiskosten"}</div>
        <div className="text-muted-foreground text-[11px] leading-tight">{personName}</div>
      </td>
      <td className="py-2 pr-4 text-xs text-muted-foreground tabular-nums whitespace-nowrap align-middle">
        {travel.quantity} × {formatEUR(unitCost)}
      </td>
      <td className="py-2 pr-3 align-middle" />
      <td className="py-2 pr-3 align-middle" />
      <td className="py-2 pr-3 text-right text-sm font-semibold tabular-nums align-middle">{formatEUR(cost)}</td>
    </tr>
  );
}

// Split out to stay under the 150-line limit; re-exported so the existing
// import sites (cost-period-section.tsx) need no change.
export { MaterialGroupCostRow } from "@/components/material-cost-row";
