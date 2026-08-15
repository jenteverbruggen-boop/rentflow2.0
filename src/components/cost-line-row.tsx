"use client";

import { LinePricePopover } from "@/components/line-price-popover";
import { BookingDiscountPopover } from "@/components/booking-discount-popover";
import { formatEUR } from "@/lib/pricing";
import { toNumber } from "@/lib/serialize";
import type { PeriodPerson, PersonTravelCost, Project } from "@/types";
import { materialGroupCost, type MaterialGroup } from "@/lib/grouping";

interface PersonRowProps {
  line: PeriodPerson;
  days: number;
  cost: number;
  periodId: number;
  project: Project;
}

interface MaterialGroupRowProps {
  group: MaterialGroup;
  days: number;
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
        {pp.role && <div className="text-muted-foreground text-[11px] leading-tight">{pp.role}</div>}
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
          basePrice={pp.person.dayPrice}
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

export function MaterialGroupCostRow({ group, days, periodId, project }: MaterialGroupRowProps) {
  const total = materialGroupCost(group, days);
  const setup = group.assignments.reduce(
    (s, a) => s + toNumber(a.setupCostSnapshot),
    0,
  );
  const override = project.materialPrices.find((p) => p.materialId === group.material.id);
  return (
    <tr className="border-b last:border-0">
      <td className="py-2 pl-3 pr-2 align-middle">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-secondary text-sm">📦</span>
      </td>
      <td className="py-2 pr-4 text-sm align-middle">
        <div className="font-medium leading-tight">
          {group.material.name}
          <span className="text-muted-foreground ml-1.5 text-xs">×{group.units}</span>
        </div>
        {group.material.category && (
          <div className="text-muted-foreground text-[11px] leading-tight">{group.material.category}</div>
        )}
      </td>
      <td className="py-2 pr-4 text-xs text-muted-foreground tabular-nums whitespace-nowrap align-middle">
        {group.units} × {days} × {formatEUR(group.dayPriceSnapshot)}
        {setup > 0 && ` + ${formatEUR(setup)} op-/afbouw`}
      </td>
      <td className="py-2 pr-3 align-middle">
        <BookingDiscountPopover
          discountPct={group.discountPct}
          discountAmount={group.discountAmount}
          patchUrls={group.assignments.map((a) => `/api/periods/${periodId}/materials/${a.id}`)}
          invalidateKey={["project", String(project.id)]}
        />
      </td>
      <td className="py-2 pr-3 text-right align-middle">
        <LinePricePopover
          snapshot={group.dayPriceSnapshot}
          basePrice={group.material.dayPrice}
          override={override ? override.dayPrice : null}
          resnapshotUrl={`/api/periods/${periodId}/materials/${group.assignments[0].id}`}
          projectId={project.id}
          kind="material"
          entityId={group.material.id}
          entityName={group.material.name}
          invalidateKey={["project", String(project.id)]}
        />
      </td>
      <td className="py-2 pr-3 text-right text-sm font-semibold tabular-nums align-middle">{formatEUR(total)}</td>
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
