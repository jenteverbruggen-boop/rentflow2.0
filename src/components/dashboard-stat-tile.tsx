import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
  label: string;
  value: string | number;
  icon: LucideIcon;
  href: string;
}

/** Compact on phones (three count tiles share a row), roomier from sm. */
export function DashboardStatTile({ label, value, icon: Icon, href }: Props) {
  return (
    <Link href={href} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl">
      <Card className="hover:bg-accent/50 transition-colors cursor-pointer h-full">
        <CardHeader className="flex-row items-center justify-between space-y-0 p-3 pb-1 sm:p-6 sm:pb-2">
          <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground truncate">{label}</CardTitle>
          <Icon className="hidden sm:block h-4 w-4 text-muted-foreground" aria-hidden />
        </CardHeader>
        <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
          <div className="text-xl sm:text-3xl font-bold tabular-nums truncate">{value}</div>
        </CardContent>
      </Card>
    </Link>
  );
}
