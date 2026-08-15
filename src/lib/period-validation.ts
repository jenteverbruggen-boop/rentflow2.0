import { z } from "zod";
import { endOfDay } from "date-fns";

/**
 * Server-side mirror of period-form.tsx's client .refine — endDate must be
 * strictly after startDate. Decided (H4.3): tightened from the client's
 * current `>=` (which allows a zero-duration period) to strict `>`, since
 * a zero-width period is nonsensical for booking and inconsistent with the
 * availability system's own strict lt/gt semantics (H3). The client
 * .refine is updated to match in the same commit.
 */
export const periodRangeSchema = z
  .object({
    name: z.string().min(1, "naam is verplicht"),
    startDate: z.coerce.date({ error: "startdatum is ongeldig" }),
    endDate: z.coerce.date({ error: "einddatum is ongeldig" }),
  })
  .refine((v) => v.endDate > v.startDate, {
    message: "einddatum moet na startdatum liggen",
    path: ["endDate"],
  });

/**
 * Decided (H4.3): the out-of-project-range warning stays advisory (a period
 * may still extend before/after the project's own dates — e.g. load-in the
 * day before). What becomes a hard rejection is a period that doesn't
 * overlap the project's span *at all*, which is very likely a mistaken
 * project selection rather than a deliberate early/late booking.
 */
export function periodOverlapsProject(
  period: { startDate: Date; endDate: Date },
  project: { startDate: Date; endDate: Date },
): boolean {
  return (
    period.startDate < endOfDay(project.endDate) &&
    period.endDate > project.startDate
  );
}
