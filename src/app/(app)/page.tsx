"use client";

import { useQuery, useQueries } from "@tanstack/react-query";
import { formatEUR } from "@/lib/pricing";
import { satisfies } from "@/lib/modules";
import { useAuthMe } from "@/hooks/use-auth-me";
import { DashboardStatTile } from "@/components/dashboard-stat-tile";
import { UpcomingProjectsCard } from "@/components/upcoming-projects-card";
import type { Project, Person, Material } from "@/types";

interface StatsResponse {
  revenueByMonth: { booked: number; invoiced: number }[];
}

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Ophalen mislukt");
  return res.json();
}

export default function DashboardPage() {
  const { data: me } = useAuthMe();
  // While scope is still resolving, treat as scoped (no company-wide
  // fetch) rather than briefly firing it then discarding the result —
  // same conservative default as mobile-sidebar.tsx's nav links (N4.2).
  const isScoped = me === undefined || me.scope === "own";

  const [projectsQuery, peopleQuery, materialsQuery] = useQueries({
    queries: [
      {
        queryKey: ["projects"],
        queryFn: () => get<Project[]>("/api/projects"),
      },
      {
        queryKey: ["people"],
        queryFn: () => get<Person[]>("/api/people"),
        enabled: !isScoped,
      },
      {
        queryKey: ["materials"],
        queryFn: () => get<Material[]>("/api/materials"),
        enabled: !isScoped,
      },
    ],
  });

  const projects = projectsQuery.data ?? [];
  const upcoming = projects
    .filter((p) => new Date(p.startDate) >= new Date())
    .slice(0, 5);

  // scope: own — people/materials/route.ts deny outright (N5.2b), so
  // there is no legal data source for those two tiles anymore. Rather
  // than fetch the company-wide catalogues and hide the count (still a
  // network-level leak even if never rendered), replace them with a
  // scope-native figure computed from the already-scoped projects
  // response: how many of the caller's own periods start today or
  // later, across every project they're booked on
  // (own-data-scoping-design.md's Dashboard section).
  const upcomingPeriodCount = projects.reduce(
    (sum, p) =>
      sum + p.periods.filter((per) => new Date(per.startDate) >= new Date()).length,
    0,
  );

  const stats = isScoped
    ? [
        { label: "Projecten", value: projects.length, icon: "📁", href: "/projects" },
        { label: "Komende periodes", value: upcomingPeriodCount, icon: "🗓️", href: "/planning" },
      ]
    : [
        { label: "Projecten", value: projects.length, icon: "📁", href: "/projects" },
        { label: "Personen", value: peopleQuery.data?.length ?? 0, icon: "👥", href: "/people" },
        { label: "Materialen", value: materialsQuery.data?.length ?? 0, icon: "📦", href: "/materials" },
      ];

  // K3.1 — headline money figures, year-to-date. Hidden entirely (not
  // just visually disabled) for a role without Cijfers:lezen — the
  // server already refuses /api/stats for scope:own and a lower
  // matrix level, this is the affordance. `useAuthMe()`'s own
  // `permissions` map is this project's `usePermissions()`-equivalent
  // (no hook of that literal name exists — verified before assuming
  // one did).
  const canSeeCijfers = !isScoped && satisfies(me?.permissions.cijfers ?? "geen", "lezen");
  const year = new Date().getFullYear();
  const statsQuery = useQuery({
    queryKey: ["stats", `${year}-01-01`, `${year}-12-31`],
    queryFn: () => get<StatsResponse>(`/api/stats?from=${year}-01-01&to=${year}-12-31`),
    enabled: canSeeCijfers,
  });
  const bookedYtd = statsQuery.data?.revenueByMonth.reduce((s, m) => s + m.booked, 0) ?? 0;
  const invoicedYtd = statsQuery.data?.revenueByMonth.reduce((s, m) => s + m.invoiced, 0) ?? 0;
  const moneyTiles = canSeeCijfers
    ? [
        { label: `Omzet ${year} (geboekt)`, value: formatEUR(bookedYtd), icon: "💶", href: "/cijfers" },
        { label: `Omzet ${year} (gefactureerd)`, value: formatEUR(invoicedYtd), icon: "🧾", href: "/cijfers" },
      ]
    : [];
  const allTiles = [...stats, ...moneyTiles];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Dashboard</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {allTiles.map((s) => (
          <DashboardStatTile key={s.label} label={s.label} value={s.value} icon={s.icon} href={s.href} />
        ))}
      </div>

      <UpcomingProjectsCard projects={upcoming} />
    </div>
  );
}
