"use client";

import { Bar, ComposedChart, Line, CartesianGrid, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { formatEUR } from "@/lib/pricing";
import type { RevenueMonthEntry } from "@/hooks/use-stats";

const chartConfig = {
  bookedPeople: { label: "Personeel", color: "var(--chart-1)" },
  bookedMaterials: { label: "Materiaal", color: "var(--chart-2)" },
  bookedTravel: { label: "Reis", color: "var(--chart-3)" },
  invoiced: { label: "Gefactureerd", color: "var(--chart-4)" },
} satisfies ChartConfig;

/** K2.2 — revenue per month: stacked bars (personeel/materiaal/reis,
 * geboekt) with the gefactureerd series as a line overlaid on top,
 * paired with a table (the PO asked for "diagrammen en tabellen").
 * Booked and invoiced are attributed to different months by design
 * (K1) — the legend note says so explicitly rather than letting the
 * chart imply they should line up. */
export function RevenueByMonthSection({ data }: { data: RevenueMonthEntry[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Omzet per maand</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {data.length === 0 ? (
          <p className="text-muted-foreground text-sm">Geen data in deze periode.</p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              Geboekt (staven) is toegewezen aan de periode; gefactureerd (lijn) aan de
              factuurdatum — deze twee lopen bewust niet gelijk.
            </p>
            <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full">
              <ComposedChart data={data} accessibilityLayer>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} width={48} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="bookedPeople" stackId="booked" fill="var(--color-bookedPeople)" />
                <Bar dataKey="bookedMaterials" stackId="booked" fill="var(--color-bookedMaterials)" />
                <Bar dataKey="bookedTravel" stackId="booked" fill="var(--color-bookedTravel)" radius={[4, 4, 0, 0]} />
                <Line dataKey="invoiced" stroke="var(--color-invoiced)" strokeWidth={2} dot={{ r: 4 }} />
              </ComposedChart>
            </ChartContainer>
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Maand</TableHead>
                    <TableHead className="text-right">Personeel</TableHead>
                    <TableHead className="text-right">Materiaal</TableHead>
                    <TableHead className="text-right">Reis</TableHead>
                    <TableHead className="text-right">Geboekt</TableHead>
                    <TableHead className="text-right">Gefactureerd</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((m) => (
                    <TableRow key={m.month}>
                      <TableCell>{m.month}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatEUR(m.bookedPeople)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatEUR(m.bookedMaterials)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatEUR(m.bookedTravel)}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">{formatEUR(m.booked)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatEUR(m.invoiced)}</TableCell>
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
