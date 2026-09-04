import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Note } from "@/types";

export interface NoteListFilter {
  projectId?: number;
  clientId?: number;
  unassigned?: boolean;
  q?: string;
}

export interface NoteFormValues {
  title: string;
  body: string;
  noteDate?: string;
  projectId?: number | null;
  clientId?: number | null;
}

function filterToQuery(filter: NoteListFilter): string {
  const params = new URLSearchParams();
  if (filter.projectId != null) params.set("projectId", String(filter.projectId));
  if (filter.clientId != null) params.set("clientId", String(filter.clientId));
  if (filter.unassigned) params.set("unassigned", "1");
  if (filter.q) params.set("q", filter.q);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

async function jsonOrThrow<T>(res: Response): Promise<T> {
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Mislukt");
  return data;
}

export function useNotes(filter: NoteListFilter = {}) {
  return useQuery({
    queryKey: ["notes", filter],
    queryFn: () => fetch(`/api/notes${filterToQuery(filter)}`).then((r) => jsonOrThrow<Note[]>(r)),
  });
}

export function useNote(id: number | null) {
  return useQuery({
    queryKey: ["notes", "detail", id],
    queryFn: () => fetch(`/api/notes/${id}`).then((r) => jsonOrThrow<Note>(r)),
    enabled: id != null,
  });
}

export function useNoteMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["notes"] });

  const create = useMutation({
    mutationFn: (values: NoteFormValues) =>
      fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      }).then((r) => jsonOrThrow<Note>(r)),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: ({ id, values }: { id: number; values: Partial<NoteFormValues> }) =>
      fetch(`/api/notes/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      }).then((r) => jsonOrThrow<Note>(r)),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/notes/${id}`, { method: "DELETE" }).then((r) => jsonOrThrow(r)),
    onSuccess: invalidate,
  });

  return { create, update, remove };
}
