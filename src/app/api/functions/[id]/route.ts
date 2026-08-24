import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  requireModule,
  forbidden,
  badRequest,
  notFound,
  conflict,
  serverError,
} from "@/lib/api-auth";
import { redactMoney } from "@/lib/redact";
import { findRejectedField, moneyFieldsToIgnore } from "@/lib/money-write-guard";
import { toNumberOrNull } from "@/lib/serialize";
import { canHardDeleteFunction, functionDeleteBlockedMessage } from "@/lib/function-deletable";

type Params = { params: Promise<{ id: string }> };
const RATE_FIELDS = ["dayRate", "hourRate"] as const;
const USAGE_COUNT_SELECT = { people: true, assignments: true, clientRates: true } as const;

// `name` is optional so the manager dialog's archive/restore toggle can
// PUT `{ archived }` alone without re-sending the full record.
const schema = z.object({
  name: z.string().min(1, "Naam is verplicht").optional(),
  dayRate: z.coerce.number().nonnegative().nullable().optional(),
  hourRate: z.coerce.number().nonnegative().nullable().optional(),
  archived: z.boolean().optional(),
});

// L1.1: resolves the phase-1 TODO(L1) markers on this file.
export async function PUT(req: NextRequest, { params }: Params) {
  const access = await requireModule("personen", "wijzigen").catch(() => null);
  if (!access) return forbidden();
  if (access.scope === "own") return forbidden();
  try {
    const { id } = await params;
    const functionId = parseInt(id);
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.issues[0].message);

    const current = await prisma.function.findUnique({ where: { id: functionId } });
    if (!current) return notFound();

    // Diff-aware, not presence-only — see money-write-guard.ts's
    // findRejectedMoneyWrite doc comment. FunctionFormDialog always
    // resubmits both rate fields (even as an explicit `null`) on every
    // save, so a presence-only check would block a caller without
    // Kosten/Facturen: wijzigen from renaming a function at all — which
    // would otherwise break the person-form pencil-edit entry point for
    // exactly the "personen: wijzigen, no money" role this app supports.
    if (findRejectedField(body, access, RATE_FIELDS, current)) {
      return forbidden();
    }

    // Money-blind caller opening the per-chip pencil dialog
    // (function-form-dialog.tsx) sees blank rate inputs and resubmits
    // `null` for both on every save, including a save that only renames
    // the function — omit the key entirely so the persisted rate
    // survives untouched (moneyFieldsToIgnore's doc comment).
    const rateIgnore = moneyFieldsToIgnore(access, RATE_FIELDS);
    const data: Record<string, unknown> = {};
    if (parsed.data.name !== undefined) data.name = parsed.data.name;
    if (parsed.data.dayRate !== undefined && !rateIgnore.has("dayRate")) data.dayRate = parsed.data.dayRate;
    if (parsed.data.hourRate !== undefined && !rateIgnore.has("hourRate")) data.hourRate = parsed.data.hourRate;
    if (parsed.data.archived !== undefined) data.archived = parsed.data.archived;

    const fn = await prisma.function.update({ where: { id: functionId }, data });
    // Review finding: same Decimal→number gap as functions/route.ts's
    // GET/POST — redactMoney doesn't convert, it only nulls for a
    // caller without access.
    return NextResponse.json(
      redactMoney({ ...fn, dayRate: toNumberOrNull(fn.dayRate), hourRate: toNumberOrNull(fn.hourRate) }, access),
    );
  } catch (err) {
    return serverError((err as Error).message);
  }
}

// dayRate/hourRate need no redaction here — this handler never returns
// the function row on success.
//
// Hard-delete only when the function is used absolutely nowhere (see
// src/lib/function-deletable.ts): PeriodPerson.functionId has no
// `onDelete` specified in schema.prisma, so Prisma defaults to
// `SetNull` — deleting a function still referenced by even one booking
// would silently null out that (possibly already-invoiced) booking's
// function. The old guard here only ever checked `_count.people`
// (current crew assignments) and ignored `assignments`/`clientRates`
// entirely.
export async function DELETE(_req: NextRequest, { params }: Params) {
  const access = await requireModule("personen", "verwijderen").catch(() => null);
  if (!access) return forbidden();
  if (access.scope === "own") return forbidden();
  try {
    const { id } = await params;
    const fn = await prisma.function.findUnique({
      where: { id: parseInt(id) },
      include: { _count: { select: USAGE_COUNT_SELECT } },
    });
    if (!fn) return notFound();
    const usage = fn._count;
    if (!canHardDeleteFunction(usage)) return conflict(functionDeleteBlockedMessage(usage));
    await prisma.function.delete({ where: { id: parseInt(id) } });
    return NextResponse.json({ success: true });
  } catch (err) {
    return serverError((err as Error).message);
  }
}
