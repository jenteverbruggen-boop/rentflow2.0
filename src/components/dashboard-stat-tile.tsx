import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
  label: string;
  value: string | number;
  icon: string;
  href: string;
}

/** K3.1 — extracted from page.tsx so adding the two money tiles doesn't
 * push the dashboard past the 150-line limit. Pure move of the
 * existing tile markup, no visual change. */
export function DashboardStatTile({ label, value, icon, href }: Props) {
  return (
    <Link href={href} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl">
      <Card className="hover:bg-accent/50 transition-colors cursor-pointer h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl">{icon}</div>
          <div className="text-3xl font-bold">{value}</div>
        </CardContent>
      </Card>
    </Link>
  );
}
