"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { statusVariant } from "@/lib/utils";
import type { Project, Person, Material } from "@/types";

async function fetchProject(id: string): Promise<Project> {
  const res = await fetch(`/api/projects/${id}`);
  if (!res.ok) throw new Error("Project niet gevonden");
  return res.json();
}

async function fetchAll<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Ophalen mislukt");
  return res.json();
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [personForm, setPersonForm] = useState({ personId: "", role: "", startDate: "", endDate: "" });
  const [materialForm, setMaterialForm] = useState({ materialId: "", quantity: "1", startDate: "", endDate: "" });
  const [bookingError, setBookingError] = useState("");

  const { data: project, isLoading } = useQuery({
    queryKey: ["project", id],
    queryFn: () => fetchProject(id),
  });
  const { data: people = [] } = useQuery({ queryKey: ["people"], queryFn: () => fetchAll<Person[]>("/api/people") });
  const { data: materials = [] } = useQuery({ queryKey: ["materials"], queryFn: () => fetchAll<Material[]>("/api/materials") });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["project", id] });
  }

  const addPerson = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/bookings/person", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: id, ...personForm }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Toevoegen mislukt");
      return data;
    },
    onSuccess: () => {
      setBookingError("");
      setPersonForm({ personId: "", role: "", startDate: "", endDate: "" });
      invalidate();
    },
    onError: (err) => setBookingError((err as Error).message),
  });

  const removePerson = useMutation({
    mutationFn: (bookingId: number) => fetch(`/api/bookings/person/${bookingId}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });

  const addMaterial = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/bookings/material", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: id, ...materialForm }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Toevoegen mislukt");
      return data;
    },
    onSuccess: () => {
      setBookingError("");
      setMaterialForm({ materialId: "", quantity: "1", startDate: "", endDate: "" });
      invalidate();
    },
    onError: (err) => setBookingError((err as Error).message),
  });

  const removeMaterial = useMutation({
    mutationFn: (bookingId: number) => fetch(`/api/bookings/material/${bookingId}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });

  if (isLoading) return <p className="text-muted-foreground">Laden...</p>;
  if (!project) return <p className="text-muted-foreground">Project niet gevonden</p>;

  return (
    <div className="max-w-3xl space-y-6">
      <Button variant="ghost" className="text-muted-foreground -ml-2" onClick={() => router.push("/projects")}>
        ← Terug
      </Button>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold">{project.name}</h2>
              <p className="text-muted-foreground text-sm mt-0.5">
                {[project.client, project.location].filter(Boolean).join(" · ")}
              </p>
              <p className="text-muted-foreground text-sm">
                {format(new Date(project.startDate), "d MMM yyyy", { locale: nl })} –{" "}
                {format(new Date(project.endDate), "d MMM yyyy", { locale: nl })}
              </p>
            </div>
            <Badge className={statusVariant(project.status)}>{project.status}</Badge>
          </div>
          {project.notes && <p className="mt-3 text-sm text-muted-foreground">{project.notes}</p>}
        </CardContent>
      </Card>

      {bookingError && (
        <Alert variant="destructive">
          <AlertDescription>{bookingError}</AlertDescription>
        </Alert>
      )}

      {/* Personen */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">👥 Personen</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            onSubmit={(e) => { e.preventDefault(); setBookingError(""); addPerson.mutate(); }}
            className="grid grid-cols-2 gap-3"
          >
            <div className="col-span-2">
              <Label className="text-xs text-muted-foreground mb-1 block">Persoon</Label>
              <Select value={personForm.personId} onValueChange={(v) => setPersonForm((f) => ({ ...f, personId: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecteer persoon" />
                </SelectTrigger>
                <SelectContent>
                  {people.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name}{p.role ? ` (${p.role})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Rol (optioneel)</Label>
              <Input
                value={personForm.role}
                onChange={(e) => setPersonForm((f) => ({ ...f, role: e.target.value }))}
                placeholder="Rol"
              />
            </div>
            <div />
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Van</Label>
              <Input
                type="date"
                required
                value={personForm.startDate}
                onChange={(e) => setPersonForm((f) => ({ ...f, startDate: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Tot</Label>
              <Input
                type="date"
                required
                value={personForm.endDate}
                onChange={(e) => setPersonForm((f) => ({ ...f, endDate: e.target.value }))}
              />
            </div>
            <Button type="submit" className="col-span-2" disabled={addPerson.isPending || !personForm.personId}>
              Persoon toevoegen
            </Button>
          </form>

          <Separator />

          <div className="space-y-2">
            {project.people.map((pp) => (
              <div key={pp.id} className="flex justify-between items-center bg-muted/40 rounded-lg px-4 py-2">
                <div>
                  <p className="text-sm font-medium">{pp.person.name}</p>
                  <p className="text-xs text-muted-foreground">{pp.role ?? pp.person.role}</p>
                </div>
                <div className="flex items-center gap-3">
                  {pp.startDate && (
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(pp.startDate), "d MMM", { locale: nl })} –{" "}
                      {format(new Date(pp.endDate!), "d MMM", { locale: nl })}
                    </span>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => removePerson.mutate(pp.id)}
                  >
                    ✕
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Materialen */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">📦 Materialen</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            onSubmit={(e) => { e.preventDefault(); setBookingError(""); addMaterial.mutate(); }}
            className="grid grid-cols-2 gap-3"
          >
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Materiaal</Label>
              <Select value={materialForm.materialId} onValueChange={(v) => setMaterialForm((f) => ({ ...f, materialId: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecteer materiaal" />
                </SelectTrigger>
                <SelectContent>
                  {materials.map((m) => (
                    <SelectItem key={m.id} value={String(m.id)}>
                      {m.name} (voorraad: {m.totalStock})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Aantal</Label>
              <Input
                type="number"
                min={1}
                required
                value={materialForm.quantity}
                onChange={(e) => setMaterialForm((f) => ({ ...f, quantity: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Van</Label>
              <Input
                type="date"
                required
                value={materialForm.startDate}
                onChange={(e) => setMaterialForm((f) => ({ ...f, startDate: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Tot</Label>
              <Input
                type="date"
                required
                value={materialForm.endDate}
                onChange={(e) => setMaterialForm((f) => ({ ...f, endDate: e.target.value }))}
              />
            </div>
            <Button type="submit" className="col-span-2" disabled={addMaterial.isPending || !materialForm.materialId}>
              Materiaal toevoegen
            </Button>
          </form>

          <Separator />

          <div className="space-y-2">
            {project.materials.map((pm) => (
              <div key={pm.id} className="flex justify-between items-center bg-muted/40 rounded-lg px-4 py-2">
                <div>
                  <p className="text-sm font-medium">{pm.material.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {[pm.material.category, `${pm.quantity}×`].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {pm.startDate && (
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(pm.startDate), "d MMM", { locale: nl })} –{" "}
                      {format(new Date(pm.endDate!), "d MMM", { locale: nl })}
                    </span>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => removeMaterial.mutate(pm.id)}
                  >
                    ✕
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
