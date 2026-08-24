import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { MaterialGroup } from "@/lib/grouping";

interface Args {
  periodId: number;
  projectId: number;
  onWarnings: (warnings: string[]) => void;
  onError: (error: string) => void;
}

interface AddArgs {
  materialId: number;
  quantity: number;
  allowOverbook?: boolean;
}

/** The add/remove-unit/remove-bundle mutations for MaterialSplitEditor,
 * extracted so the component itself stays ≤150 lines (Y3.6). The shortage
 * mutations (overboeken) live here too so the assigned rows can take a
 * phantom unit away the same way they take a real one. */
export function useMaterialSplitMutations({
  periodId,
  projectId,
  onWarnings,
  onError,
}: Args) {
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["project", String(projectId)] });
    queryClient.invalidateQueries({ queryKey: ["available"] });
  };

  const add = useMutation({
    mutationFn: async (args: AddArgs) => {
      const res = await fetch(`/api/periods/${periodId}/materials`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(args),
      });
      const data = await res.json();
      if (!res.ok) {
        // Safety net: the row already showed the live overbook hint and
        // passes allowOverbook itself, so a 409 with `shortfall` here means
        // the stock moved under us — name the numbers rather than the bare
        // "Onvoldoende voorraad".
        if (res.status === 409 && data.shortfall) {
          throw new Error(
            `Niet genoeg vrij — gevraagd: ${data.shortfall.requested}, beschikbaar: ${data.shortfall.available}`,
          );
        }
        throw new Error(data.error ?? "Toevoegen mislukt");
      }
      return data as { warnings: string[] };
    },
    onSuccess: (data) => {
      onWarnings(data.warnings ?? []);
      onError("");
      invalidate();
    },
    onError: (err) => onError((err as Error).message),
  });

  const removeOne = useMutation({
    mutationFn: (assignmentId: number) =>
      fetch(`/api/periods/${periodId}/materials/${assignmentId}`, {
        method: "DELETE",
      }),
    onSuccess: invalidate,
  });

  const removeBundle = useMutation({
    mutationFn: (bundleBookingId: number) =>
      fetch(`/api/periods/${periodId}/bundles/${bundleBookingId}`, {
        method: "DELETE",
      }),
    onSuccess: invalidate,
  });

  /** Overboeken — `quantity: 0` deletes the row server-side. */
  const setShortageQuantity = useMutation({
    mutationFn: (args: { shortageId: number; quantity: number }) =>
      fetch(`/api/periods/${periodId}/shortages/${args.shortageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity: args.quantity }),
      }),
    onSuccess: invalidate,
  });

  /** Takes an overbooked (phantom) unit away before ever touching a real
   * assignment — the phantom units are the ones blocking confirmation. */
  const removeOneFromGroup = (group: MaterialGroup) => {
    if (group.overbookedUnits > 0 && group.shortageIds.length > 0) {
      setShortageQuantity.mutate({
        shortageId: group.shortageIds[group.shortageIds.length - 1],
        quantity: 0,
      });
      return;
    }
    const last = group.assignments[group.assignments.length - 1];
    if (last) removeOne.mutate(last.id);
  };

  const removeAllInGroup = (group: MaterialGroup) => {
    for (const id of group.shortageIds)
      setShortageQuantity.mutate({ shortageId: id, quantity: 0 });
    for (const a of group.assignments) removeOne.mutate(a.id);
  };

  return {
    add,
    removeOne,
    removeBundle,
    setShortageQuantity,
    removeOneFromGroup,
    removeAllInGroup,
  };
}
