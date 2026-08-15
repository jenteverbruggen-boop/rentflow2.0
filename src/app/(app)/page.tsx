"use client";

import Link from "next/link";
import { useQueries } from "@tanstack/react-query";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { statusVariant } from "@/lib/utils";
import { useAuthMe } from "@/hooks/use-auth-me";
import type { Project, Person, Material } from "@/types";

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

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Dashboard</h2>

      <div
        className={`grid grid-cols-1 gap-4 ${isScoped ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}
      >
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl"
          >
            <Card className="hover:bg-accent/50 transition-colors cursor-pointer h-full">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {s.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl">{s.icon}</div>
                <div className="text-3xl font-bold">{s.value}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Aankomende projecten</CardTitle>
        </CardHeader>
        <CardContent>
          {upcoming.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Geen aankomende projecten
            </p>
          ) : (
            <div className="space-y-2">
              {upcoming.map((p) => (
                <Link
                  key={p.id}
                  href={`/projects/${p.id}`}
                  className="flex items-center justify-between gap-3 hover:bg-accent px-3 py-2 rounded-lg transition-colors"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{p.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {[p.client, p.location].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-muted-foreground hidden sm:block">
                      {format(new Date(p.startDate), "d MMM", { locale: nl })}
                    </span>
                    <Badge className={statusVariant(p.status)}>
                      {p.status}
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
