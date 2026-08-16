"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { formatEUR } from "@/lib/pricing";
import type { TopMaterialEntry } from "@/hooks/use-stats";

const chartConfig = {
  revenue: { label: "Omzet", color: "var(--chart-2)" },
} satisfies ChartConfig;

/** K2.3 — top 10 materials by booked revenue in the range (already
 * excludes archived materials, M1.3 — computed server-side). */
export function TopMaterialsSection({ data }: { data: TopMaterialEntry[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Top materialen</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {data.length === 0 ? (
          <p className="text-muted-foreground text-sm">Geen data in deze periode.</p>
        ) : (
          <>
            <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full">
              <BarChart data={data} layout="vertical" accessibilityLayer>
                <CartesianGrid horizontal={false} />
                <XAxis type="number" tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} width={100} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ChartContainer>
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Materiaal</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead className="text-right">Omzet</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((m) => (
                    <TableRow key={m.materialId}>
                      <TableCell className="max-w-40 truncate">{m.name}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">{m.code ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatEUR(m.revenue)}</TableCell>
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
