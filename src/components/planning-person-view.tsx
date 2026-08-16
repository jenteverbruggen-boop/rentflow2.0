"use client";

import Link from "next/link";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { statusVariant } from "@/lib/utils";
import type { PersonRow, PersonBooking } from "@/lib/planning-person-rows";

function fmtBookingWindow(b: PersonBooking): string {
  if (b.billingUnit === "uur" && b.startAt && b.endAt) {
    return `${format(new Date(b.periodStart), "d MMM", { locale: nl })} ${format(new Date(b.startAt), "HH:mm")}–${format(new Date(b.endAt), "HH:mm")}`;
  }
  return `${format(new Date(b.periodStart), "d MMM", { locale: nl })} – ${format(new Date(b.periodEnd), "d MMM yyyy", { locale: nl })}`;
}

/**
 * I3.1/I3.2 — one row (card) per person, their bookings across the
 * visible range. A booking with `overlapAck` (H2's deliberate-double-
 * booking flag) is badged — this is where a forced double booking
 * becomes visible at a glance, the whole point of building this view.
 */
export function PlanningPersonView({ rows }: { rows: PersonRow[] }) {
  if (rows.length === 0) {
    return <p className="text-muted-foreground text-sm">Geen boekingen in deze periode.</p>;
  }

  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <Card key={row.personId}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{row.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {row.bookings.map((b) => (
              <Link
                key={b.periodPersonId}
                href={`/projects/${b.projectId}`}
                className="flex items-center justify-between gap-3 hover:bg-accent px-2 py-1.5 rounded-lg transition-colors text-sm"
              >
                <div className="min-w-0">
                  <p className="font-medium truncate">{b.projectName}</p>
                  <p className="text-xs text-muted-foreground">{fmtBookingWindow(b)}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {b.overlapAck && <Badge variant="destructive">Dubbel geboekt</Badge>}
                  <Badge className={statusVariant(b.status)}>{b.status}</Badge>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
