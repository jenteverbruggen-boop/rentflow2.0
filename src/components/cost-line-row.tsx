"use client";

import { LinePricePopover } from "@/components/line-price-popover";
import { BookingDiscountPopover } from "@/components/booking-discount-popover";
import { formatEUR, lineCost } from "@/lib/pricing";
import type { PeriodPerson, Project } from "@/types";
import type { MaterialGroup } from "@/lib/grouping";

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
  const perUnit = lineCost(group.dayPriceSnapshot, days, group);
  const total = perUnit * group.units;
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
