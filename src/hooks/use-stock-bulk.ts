import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  StockBulkAddResult,
  StockBulkConflict,
  StockBulkRemoveResult,
} from "@/types";

/** Carries the 409 conflict's blocker details alongside the Dutch
 * message, so StockBulkControls can render the exact blocker list and
 * offer its quick-fix without a second round trip. */
export class StockBulkError extends Error {
  blockedUnits: number[];
  removable: number | null;
  removableFromTop: number | null;

  constructor(
    message: string,
    blockedUnits: number[] = [],
    removable: number | null = null,
    removableFromTop: number | null = null,
  ) {
    super(message);
    this.name = "StockBulkError";
    this.blockedUnits = blockedUnits;
    this.removable = removable;
    this.removableFromTop = removableFromTop;
  }
}

async function parseOrThrow<T>(res: Response): Promise<T> {
  const data = await res.json();
  if (!res.ok) {
    const body = data as Partial<StockBulkConflict>;
    throw new StockBulkError(
      body.error ?? "Mislukt",
      body.blockedUnits ?? [],
      body.removable ?? null,
      body.removableFromTop ?? null,
    );
  }
  return data as T;
}

type RemoveBody = { count: number } | { ids: number[] };

/** bulkAdd/bulkRemove mutations for the units sheet's bulk controls.
 * `.data`/`.error` from each mutation double as "the last result" the
 * sheet renders inline — no extra state needed here. */
export function useStockBulk(materialId: number | undefined) {
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["materials"] });
    queryClient.invalidateQueries({ queryKey: ["material", materialId, "stock-items"] });
  };

  const bulkAdd = useMutation({
    mutationFn: async (count: number) => {
      const res = await fetch(`/api/materials/${materialId}/stock-items/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count }),
      });
      return parseOrThrow<StockBulkAddResult>(res);
    },
    onSuccess: invalidate,
  });

  const bulkRemove = useMutation({
    mutationFn: async (body: RemoveBody) => {
      const res = await fetch(`/api/materials/${materialId}/stock-items/bulk`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      return parseOrThrow<StockBulkRemoveResult>(res);
    },
    onSuccess: invalidate,
  });

  return { bulkAdd, bulkRemove };
}
