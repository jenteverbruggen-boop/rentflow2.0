import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthMe } from "@/hooks/use-auth-me";
import { hasAccess } from "@/lib/me-access";
import type { Note } from "@/types";

export interface AssignablePerson {
  id: number;
  name: string;
}

/** Scoped (freelancer) users can't hand notes to colleagues — the server
 * ignores their assigneeIds — so don't offer the controls either. */
export function useCanAssignNotes(): boolean {
  const { data: me } = useAuthMe();
  return me?.scope === "all" && hasAccess(me, "notities", "wijzigen");
}

/** Everyone a note can be assigned to. Only fetched for callers who may
 * assign (`enabled`) — the endpoint refuses scoped users. */
export function useAssignablePeople(enabled: boolean) {
  return useQuery<AssignablePerson[]>({
    queryKey: ["notes", "assignable-people"],
    enabled,
    queryFn: async () => {
      const res = await fetch("/api/notes/assignable-people");
      if (!res.ok) throw new Error("Personen ophalen mislukt");
      return res.json();
    },
  });
}

/** Tick off / reopen my own part of an assigned note. */
export function useToggleMyDone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ noteId, done }: { noteId: number; done: boolean }) => {
      const res = await fetch(`/api/notes/${noteId}/assignees/me`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ done }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Mislukt");
      return data as Note;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notes"] }),
  });
}
