import { useMutation } from "@tanstack/react-query";

interface Args {
  periodId: number;
  invalidate: () => void;
  onWarnings: (warnings: string[]) => void;
}

/** Overboeken + inhuur row mutations of a period (open shortage and hired-in
 * rows), split out of useMaterialSplitMutations to stay under 150 lines. */
export function useShortageMutations({ periodId, invalidate, onWarnings }: Args) {
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
    onSuccess: (data) => {
      onWarnings([`Vergeet ${data.supplierName} niet af te bellen`]);
      invalidate();
    },
  });

  return { setShortageQuantity, removeHired };
}
