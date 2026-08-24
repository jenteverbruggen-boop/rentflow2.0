"use client";

import { LinePricePopover } from "@/components/line-price-popover";
import { BookingDiscountPopover } from "@/components/booking-discount-popover";
import { OverbookBadge } from "@/components/overbook-badge";
import { formatEUR } from "@/lib/pricing";
import { toNumber } from "@/lib/serialize";
import { materialGroupCost, type MaterialGroup } from "@/lib/grouping";
import type { Project } from "@/types";

interface MaterialGroupRowProps {
  group: MaterialGroup;
  days: number;
  periodId: number;
  project: Project;
}

/** The material line of the Kosten tab, split out of cost-line-row.tsx to
 * keep both files under the 150-line limit once the overboeken markers and
 * the phantom-line guards landed. */
export function MaterialGroupCostRow({ group, days, periodId, project }: MaterialGroupRowProps) {
  const total = materialGroupCost(group, days);
  // Overboeken — the per-unit op-/afbouw of phantom units is part of
  // materialGroupCost too, so the explanatory text must name it as well or
  // the line reads as if it does not add up.
  const setup =
    group.assignments.reduce((s, a) => s + toNumber(a.setupCostSnapshot), 0) +
    group.overbookedSetup;
  const override = project.materialPrices.find((p) => p.materialId === group.material.id);
  return (
    <tr className="border-b last:border-0">
      <td className="py-2 pl-3 pr-2 align-middle">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-secondary text-sm">📦</span>
      </td>
      <td className="py-2 pr-4 text-sm align-middle">
        <div className="font-medium leading-tight flex items-center gap-1.5">
          <span>
            {group.material.name}
            <span className="text-muted-foreground ml-1.5 text-xs">×{group.units}</span>
          </span>
          {group.overbookedUnits > 0 && (
            <OverbookBadge units={group.overbookedUnits} materialName={group.material.name} />
          )}
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
        {/* With no real assignment there is nothing to PATCH, and the
            popover would silently save nothing — show it as inert instead. */}
        {group.assignments.length > 0 ? (
          <BookingDiscountPopover
            discountPct={group.discountPct}
            discountAmount={group.discountAmount}
            patchUrls={group.assignments.map((a) => `/api/periods/${periodId}/materials/${a.id}`)}
            invalidateKey={["project", String(project.id)]}
          />
        ) : (
          <span
            className="inline-block h-7 w-20 rounded-md border border-dashed bg-muted/30 px-2 text-xs leading-7 text-muted-foreground print:hidden"
            title="Korting kan pas worden ingesteld als de units zijn toegewezen"
          >
            –% / –€
          </span>
        )}
      </td>
      <td className="py-2 pr-3 text-right align-middle">
        {/* A wholly-overbooked line has no assignment to re-snapshot. */}
        {group.assignments.length > 0 ? (
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
        ) : (
          <span className="text-xs text-muted-foreground tabular-nums">
            {formatEUR(group.dayPriceSnapshot)}/d
          </span>
        )}
      </td>
      <td className="py-2 pr-3 text-right text-sm font-semibold tabular-nums align-middle">{formatEUR(total)}</td>
    </tr>
  );
}
