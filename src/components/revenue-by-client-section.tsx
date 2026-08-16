"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { formatEUR } from "@/lib/pricing";
import type { RevenueClientEntry } from "@/hooks/use-stats";

const chartConfig = {
  booked: { label: "Geboekt", color: "var(--chart-1)" },
} satisfies ChartConfig;

/** K2.2 — revenue per client: horizontal bars, top 10 + "overige",
 * paired with a table. One series (booked) — no legend needed, the
 * card title names it. */
export function RevenueByClientSection({ data }: { data: RevenueClientEntry[] }) {
  const sorted = [...data].sort((a, b) => b.booked - a.booked);
  const top = sorted.slice(0, 10);
  const rest = sorted.slice(10);
  const overige = rest.length > 0
    ? { clientId: -1, name: "Overige", booked: rest.reduce((s, c) => s + c.booked, 0), invoiced: rest.reduce((s, c) => s + c.invoiced, 0) }
    : null;
  const rows = overige ? [...top, overige] : top;

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
              <BarChart data={rows} layout="vertical" accessibilityLayer>
                <CartesianGrid horizontal={false} />
                <XAxis type="number" tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} width={100} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="booked" fill="var(--color-booked)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ChartContainer>
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Klant</TableHead>
                    <TableHead className="text-right">Geboekt</TableHead>
                    <TableHead className="text-right">Gefactureerd</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((c) => (
                    <TableRow key={c.clientId}>
                      <TableCell className="max-w-40 truncate">{c.name}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatEUR(c.booked)}</TableCell>
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
