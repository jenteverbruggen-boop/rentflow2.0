import { z } from "zod";
import { brusselsStartOfDay, brusselsEndOfDay } from "@/lib/brussels-time";

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
  // Review fix: project.startDate/endDate are stored as bare calendar
  // dates (UTC midnight of the selected day, per project-form.tsx's
  // date-only input); period.startDate/endDate carry real Brussels
  // wall-clock instants (H1). Comparing them as raw instants without
  // widening the project's own dates to their full Brussels calendar
  // day was wrong near midnight: a period starting early morning
  // Brussels time on the project's own start date could convert to a
  // UTC instant *before* the project's UTC-midnight start, and get
  // flagged as not overlapping at all — worse in winter/summer
  // differently, since the UTC offset (CET +1 / CEST +2) shifts which
  // wall-clock hours fall before UTC midnight. date-fns's own
  // endOfDay/startOfDay read the *server's* local timezone, which this
  // project's own Time rule says is never reliable — use the explicit,
  // DST-aware Brussels conversion on both ends instead.
  return (
    period.startDate < brusselsEndOfDay(project.endDate) &&
    period.endDate > brusselsStartOfDay(project.startDate)
  );
}
