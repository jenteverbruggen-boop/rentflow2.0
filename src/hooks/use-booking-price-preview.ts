import { useQuery } from "@tanstack/react-query";

export interface PricePreview {
  dayPriceSnapshot: number | null;
  source: string;
  unit: "dag" | "uur";
}

/** BookPersonDialog's own two price-preview queries, extracted so the
 * dialog itself fits the 150-line limit: the live preview for whatever
 * unit is currently selected, plus an independent check (always
 * "uur") for whether an hourly rate exists anywhere in the cascade at
 * all — used to decide whether the dag/uur picker is worth showing. */
export function useBookingPricePreview(
  periodId: number,
  personId: number | undefined,
  functionId: number | null,
  unit: "dag" | "uur",
) {
  const { data: preview } = useQuery({
    queryKey: ["preview-price", periodId, personId, functionId, unit],
    queryFn: () =>
      fetch(
        `/api/periods/${periodId}/people/preview-price?personId=${personId}&unit=${unit}` +
          (functionId ? `&functionId=${functionId}` : ""),
      ).then((r) => r.json()) as Promise<PricePreview>,
    enabled: personId != null,
  });

  const { data: hourCheck } = useQuery({
    queryKey: ["preview-price", periodId, personId, functionId, "uur"],
    queryFn: () =>
      fetch(
        `/api/periods/${periodId}/people/preview-price?personId=${personId}&unit=uur` +
          (functionId ? `&functionId=${functionId}` : ""),
      ).then((r) => r.json()) as Promise<{ unit: "dag" | "uur" }>,
    enabled: personId != null && functionId != null,
  });

  return { preview, hasHourRate: hourCheck?.unit === "uur" };
}
