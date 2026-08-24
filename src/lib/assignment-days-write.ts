import type { PrismaClient } from "@/generated/prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { daysEnvelope, validateAssignmentDays } from "@/lib/assignment-days";
import { validateAssignmentWindow } from "@/lib/assignment-window";

/**
 * H6 — replace an assignment's selected days wholesale (the picker always
 * sends the complete set; an empty set means "back to the whole period").
 *
 * One transaction, because the day rows and the `startAt`/`endAt`
 * envelope on `PeriodPerson` must never disagree: every consumer that
 * only understands a single window — the planning board, the ICS feed,
 * the availability pre-filter — reads the envelope, and a half-written
 * pair would silently mis-report both availability and cost.
 */
export async function saveAssignmentDays(
  assignmentId: number,
  days: { startAt: Date; endAt: Date }[],
  client: PrismaClient = defaultPrisma,
): Promise<void> {
  const envelope = daysEnvelope(days);
  await client.$transaction(async (tx) => {
    await tx.periodPersonDay.deleteMany({ where: { periodPersonId: assignmentId } });
    if (days.length > 0) {
      await tx.periodPersonDay.createMany({
        data: days.map((d) => ({
          periodPersonId: assignmentId,
          startAt: d.startAt,
          endAt: d.endAt,
        })),
      });
    }
    await tx.periodPerson.update({
      where: { id: assignmentId },
      data: {
        startAt: envelope?.startAt ?? null,
        endAt: envelope?.endAt ?? null,
      },
    });
  });
}

interface WindowUpdateBody {
  startAt?: unknown;
  endAt?: unknown;
  days?: unknown;
}

/**
 * Resolves the "when is this person actually working" part of an
 * assignment PATCH — H6's day set, or H1.3's single window — and returns
 * an error message, or null on success. Day rows are written here (they
 * live in their own table); the single-window case only fills `data` for
 * the caller's own `periodPerson.update`.
 *
 * Extracted from the route handler: with three shapes to accept and two
 * of them mutually exclusive, inlining it pushed the handler past both
 * the file-size and the complexity budget.
 */
export async function applyAssignmentWindowUpdate(
  assignmentId: number,
  body: WindowUpdateBody,
  period: { startDate: Date; endDate: Date },
  data: Record<string, unknown>,
  client: PrismaClient = defaultPrisma,
): Promise<string | null> {
  const { startAt, endAt, days } = body;

  // The day picker always sends the complete set; `[]` clears it back to
  // "the whole period". It owns startAt/endAt (the envelope), so it is
  // handled instead of the single-window branch, never alongside it.
  if (days !== undefined) {
    if (!Array.isArray(days)) return "days moet een lijst zijn";
    const parsed = (days as { startAt?: string; endAt?: string }[]).map((d) => ({
      startAt: new Date(d?.startAt ?? NaN),
      endAt: new Date(d?.endAt ?? NaN),
    }));
    const error = validateAssignmentDays(parsed, period);
    if (error) return error;
    await saveAssignmentDays(assignmentId, parsed, client);
    return null;
  }

  if (startAt === undefined && endAt === undefined) return null;
  if (startAt === null && endAt === null) {
    // Clearing back to "inherit the period window".
    data.startAt = null;
    data.endAt = null;
    return null;
  }
  if (startAt == null || endAt == null) {
    return "startAt en endAt moeten samen worden opgegeven";
  }
  const window = { startAt: new Date(startAt as string), endAt: new Date(endAt as string) };
  const invalid = validateAssignmentWindow(window, period);
  if (invalid) return invalid;
  data.startAt = window.startAt;
  data.endAt = window.endAt;
  return null;
}
