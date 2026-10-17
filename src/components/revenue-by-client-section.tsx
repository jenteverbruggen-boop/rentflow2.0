"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { formatEUR } from "@/lib/pricing";
import { pendingHatchDefs } from "@/components/pending-hatch";
import type { RevenueClientEntry } from "@/hooks/use-stats";

const chartConfig = {
  agreed: { label: "Afgesproken", color: "var(--chart-1)" },
  pending: { label: "Nog te bevestigen", color: "var(--muted-foreground)" },
} satisfies ChartConfig;

/** K2.2 — revenue per client: horizontal bars, top 10 + "overige",
 * paired with a table. One series (booked) — no legend needed, the
 * card title names it. */
export function RevenueByClientSection({ data }: { data: RevenueClientEntry[] }) {
  const sorted = [...data].sort((a, b) => b.booked.agreed + b.booked.pending - (a.booked.agreed + a.booked.pending));
  const top = sorted.slice(0, 10);
  const rest = sorted.slice(10);
  const overige = rest.length > 0
    ? {
        clientId: -1, name: "Overige",
        booked: { agreed: rest.reduce((s, c) => s + c.booked.agreed, 0), pending: rest.reduce((s, c) => s + c.booked.pending, 0) },
        invoiced: rest.reduce((s, c) => s + c.invoiced, 0),
      }
    : null;
  const rows = overige ? [...top, overige] : top;
  const chartRows = rows.map((c) => ({ name: c.name, agreed: c.booked.agreed, pending: c.booked.pending }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Omzet per klant</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">Geen data in deze periode.</p>
        ) : (
          <>
            <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full">
              <BarChart data={chartRows} layout="vertical" accessibilityLayer>
                {pendingHatchDefs}
                <CartesianGrid horizontal={false} />
                <XAxis type="number" tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} width={100} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="agreed" stackId="booked" fill="var(--color-agreed)" />
                <Bar dataKey="pending" stackId="booked" fill="url(#pending-hatch)" stroke="var(--color-pending)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ChartContainer>
            <div className="overflow-x-auto rounded-lg border">
              <Table className="table-sticky-first">
                <TableHeader>
                  <TableRow>
                    <TableHead>Klant</TableHead>
                    <TableHead className="text-right">Afgesproken</TableHead>
                    <TableHead className="text-right">Nog te bevestigen</TableHead>
                    <TableHead className="text-right">Gefactureerd</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((c) => (
                    <TableRow key={c.clientId}>
                      <TableCell className="max-w-40 truncate">{c.name}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatEUR(c.booked.agreed)}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{formatEUR(c.booked.pending)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatEUR(c.invoiced)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
