import { useRef } from "react";
import { useMutation } from "@tanstack/react-query";

interface Args {
  periodId: number;
  invalidate: () => void;
  onWarnings: (warnings: string[]) => void;
  onError: (error: string) => void;
}

/** Overboeken + inhuur row mutations of a period (open shortage and hired-in
 * rows), split out of useMaterialSplitMutations to stay under 150 lines. */
export function useShortageMutations({ periodId, invalidate, onWarnings, onError }: Args) {
  // Trashing a group can remove hired rows from several suppliers at once:
  // collect every supplier of this batch into one warning.
  const inflight = useRef(0);
  const suppliers = useRef(new Set<string>());

  /** `quantity: 0` (or `decrement` down to 0) deletes the row server-side. */
  const setShortageQuantity = useMutation({
    mutationFn: (args: { shortageId: number } & ({ quantity: number } | { decrement: number })) =>
      fetch(`/api/periods/${periodId}/shortages/${args.shortageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify("decrement" in args ? { decrement: args.decrement } : { quantity: args.quantity }),
      }),
    onSuccess: invalidate,
  });

  /** Removes hired-in units; warns to call the supplier off. */
  const removeHired = useMutation({
    mutationFn: async (args: { shortageId: number; count: number | "all" }) => {
      const res = await fetch(`/api/periods/${periodId}/shortages/${args.shortageId}/subhire/remove`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: args.count }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error((data as { error?: string } | null)?.error ?? "Verwijderen mislukt");
      return data as { supplierName: string; removed: number };
    },
    onMutate: () => {
      if (inflight.current === 0) suppliers.current.clear();
      inflight.current += 1;
    },
    onSuccess: (data) => {
      suppliers.current.add(data.supplierName);
      onWarnings([`Vergeet ${[...suppliers.current].join(", ")} niet af te bellen`]);
      onError("");
      invalidate();
    },
    onError: (err) => onError((err as Error).message),
    onSettled: () => {
      inflight.current -= 1;
    },
  });

  return { setShortageQuantity, removeHired };
}
