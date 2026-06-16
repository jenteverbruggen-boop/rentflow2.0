"use client";

import Link from "next/link";
import { useQueries } from "@tanstack/react-query";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { statusVariant } from "@/lib/utils";
import type { Project, Person, Material } from "@/types";

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Ophalen mislukt");
  return res.json();
}

export default function DashboardPage() {
  const [projectsQuery, peopleQuery, materialsQuery] = useQueries({
    queries: [
      { queryKey: ["projects"], queryFn: () => get<Project[]>("/api/projects") },
      { queryKey: ["people"], queryFn: () => get<Person[]>("/api/people") },
      { queryKey: ["materials"], queryFn: () => get<Material[]>("/api/materials") },
    ],
  });

  const projects = projectsQuery.data ?? [];
  const upcoming = projects
    .filter((p) => new Date(p.startDate) >= new Date())
    .slice(0, 5);

  const stats = [
    { label: "Projecten", value: projects.length, icon: "📁" },
    { label: "Personen", value: peopleQuery.data?.length ?? 0, icon: "👥" },
    { label: "Materialen", value: materialsQuery.data?.length ?? 0, icon: "📦" },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Dashboard</h2>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl">{s.icon}</div>
              <div className="text-3xl font-bold">{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Aankomende projecten</CardTitle>
        </CardHeader>
        <CardContent>
          {upcoming.length === 0 ? (
            <p className="text-muted-foreground text-sm">Geen aankomende projecten</p>
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
                    <Badge className={statusVariant(p.status)}>{p.status}</Badge>
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
