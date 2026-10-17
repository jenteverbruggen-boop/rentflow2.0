import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { MaterialGroup } from "@/lib/grouping";
import { nextUnitToRemove } from "@/lib/next-unit-to-remove";
import { useShortageMutations } from "@/hooks/use-shortage-mutations";

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
  /** Hire the units beyond stock in from this supplier. */
  subhire?: { supplierId: number };
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
          // The server's own message wins when it has one: for a set it names
          // the component that ran short.
          throw new Error(
            data.error ??
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

  const { setShortageQuantity, removeHired } = useShortageMutations({ periodId, invalidate, onWarnings, onError });

  /** Takes an open (overbooked) unit away first — those block confirmation —
   * then a hired-in unit, then a real assignment. */
  const removeOneFromGroup = (group: MaterialGroup) => {
    const next = nextUnitToRemove(group);
    if (!next) return;
    if (next.kind === "open") setShortageQuantity.mutate({ shortageId: next.shortageId, decrement: 1 });
    else if (next.kind === "hired") removeHired.mutate({ shortageId: next.shortageId, count: 1 });
    else removeOne.mutate(next.assignmentId);
  };

  const removeAllInGroup = (group: MaterialGroup) => {
    for (const id of group.shortageIds) setShortageQuantity.mutate({ shortageId: id, quantity: 0 });
    for (const id of group.subhireIds) removeHired.mutate({ shortageId: id, count: "all" });
    for (const a of group.assignments) removeOne.mutate(a.id);
  };

  return {
    add,
    removeOne,
    removeBundle,
    setShortageQuantity,
    removeHired,
    removeOneFromGroup,
    removeAllInGroup,
  };
}
