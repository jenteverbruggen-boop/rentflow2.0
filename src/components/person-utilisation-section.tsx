"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import type { PersonUtilisationEntry } from "@/hooks/use-stats";

const chartConfig = {
  bookedDays: { label: "Dagen", color: "var(--chart-1)" },
} satisfies ChartConfig;

/**
 * K2.3 — person utilisation. `/api/stats` returns one lifetime-of-the-
 * range total per person (bookedDays/bookedHours), not a per-month
 * breakdown, so this renders as a top-10-by-days horizontal bar
 * (matching the revenue-by-client chart's shape) rather than the
 * brief's literal "grouped bars per month" — that would need a new,
 * separately-bucketed field on the stats endpoint, which is out of
 * scope for this UI-only item. The table still shows every person,
 * both figures.
 */
export function PersonUtilisationSection({ data }: { data: PersonUtilisationEntry[] }) {
  const sorted = [...data].sort((a, b) => b.bookedDays - a.bookedDays);
  const top = sorted.slice(0, 10);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Personeelsbezetting</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {data.length === 0 ? (
          <p className="text-muted-foreground text-sm">Geen data in deze periode.</p>
        ) : (
          <>
            <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full">
              <BarChart data={top} layout="vertical" accessibilityLayer>
                <CartesianGrid horizontal={false} />
                <XAxis type="number" tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} width={100} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="bookedDays" fill="var(--color-bookedDays)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ChartContainer>
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Persoon</TableHead>
                    <TableHead className="text-right">Dagen</TableHead>
                    <TableHead className="text-right">Uren</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map((p) => (
                    <TableRow key={p.personId}>
                      <TableCell className="max-w-40 truncate">{p.name}</TableCell>
                      <TableCell className="text-right tabular-nums">{p.bookedDays}</TableCell>
                      <TableCell className="text-right tabular-nums">{p.bookedHours}</TableCell>
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
