import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireModule,
  badRequest,
  forbidden,
  serverError,
} from "@/lib/api-auth";
import { toNumber } from "@/lib/serialize";
import { redactMoney } from "@/lib/redact";
import { findRejectedMoneyWrite, moneyFieldsToIgnore } from "@/lib/money-write-guard";
import { findRejectedFunctionRate, personFunctionRateData } from "@/lib/person-function-rate-guard";
import { diffFunctionIds } from "@/lib/person-functions-diff";
import { personSchema, serializePersonFunction } from "../route";

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  const access = await requireModule("personen", "wijzigen").catch(() => null);
  if (!access) return forbidden();
  // Already unreachable for scope: own (requireModule's read-only rule,
  // N5.1) — kept explicit per own-data-scoping-design.md §5/§8's
  // uniform, mechanical rule across this file list.
  if (access.scope === "own") return forbidden();

  try {
    const { id } = await params;
    const personId = parseInt(id);
    const body = await req.json();

    // Compared against the persisted row, not just checked for presence
    // (money-write-guard.ts's findRejectedMoneyWrite doc comment) — PersonForm always
    // resubmits `dayPrice` on every save, so a presence-only check would
    // block a caller without Kosten/Facturen: wijzigen from saving any
    // person edit at all.
    const currentPerson = await prisma.person.findUnique({
      where: { id: personId },
      select: { dayPrice: true },
    });
    if (findRejectedMoneyWrite(body, access, currentPerson)) return forbidden();

    const parsed = personSchema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.issues[0].message);
    const { name, email, phone, dayPrice, address, postalCode, city, country, functions } = parsed.data;

    // L1.1: diff instead of deleteMany+create — the old destructive
    // write would wipe every PersonFunction row (and, since DDL-2, its
    // per-person rate override) on any save that merely touches an
    // unrelated field. Rows for functions that stay assigned are left
    // untouched by the nested write; only the actual add/remove set is
    // written there. L1.3 adds a second step below: a kept row's rate
    // may itself have been *edited* in the form (not added/removed), so
    // those rows get an explicit update after the nested write.
    let functionsWrite;
    let toUpdateRates: typeof functions = [];
    if (functions !== undefined) {
      const existing = await prisma.personFunction.findMany({
        where: { personId },
        select: { functionId: true, dayRate: true, hourRate: true },
      });
      const existingIds = existing.map((e) => e.functionId);
      const nextIds = functions.map((f) => f.functionId);
      const { toAdd, toRemove } = diffFunctionIds(existingIds, nextIds);

      // Diff-aware per-row rate guard (person-function-rate-guard.ts) —
      // an added row (no entry in the map) diffs against `null`, a kept
      // row diffs against its own persisted rate.
      const currentByFunctionId = new Map(
        existing.map((e) => [e.functionId, { dayRate: e.dayRate, hourRate: e.hourRate }]),
      );
      if (findRejectedFunctionRate(functions, access, currentByFunctionId)) return forbidden();

      functionsWrite = {
        deleteMany: { functionId: { in: toRemove } },
        create: functions
          .filter((f) => toAdd.includes(f.functionId))
          .map((f) => ({
            functionId: f.functionId,
            ...personFunctionRateData(f, access),
          })),
      };
      toUpdateRates = functions.filter((f) => !toAdd.includes(f.functionId));
    }

    const dayPriceIgnore = moneyFieldsToIgnore(access, ["dayPrice"]);
    const person = await prisma.person.update({
      where: { id: personId },
      data: {
        name,
        email,
        phone,
        ...(dayPriceIgnore.has("dayPrice") ? {} : { dayPrice: dayPrice ?? 0 }),
        address,
        postalCode,
        city,
        country,
        functions: functionsWrite,
      },
      include: { functions: { include: { function: true } } },
    });

    for (const f of toUpdateRates) {
      // Money-blind: personFunctionRateData returns {} (moneyFieldsToIgnore
      // strips both keys), so this update is skipped entirely and the
      // persisted rate override survives untouched, not overwritten with
      // the caller's redacted null.
      const rateData = personFunctionRateData(f, access);
      if (Object.keys(rateData).length === 0) continue;
      await prisma.personFunction.update({
        where: { personId_functionId: { personId, functionId: f.functionId } },
        data: rateData,
      });
    }
    const withUpdatedRates = toUpdateRates.length
      ? await prisma.person.findUnique({
          where: { id: personId },
          include: { functions: { include: { function: true } } },
        })
      : person;

    return NextResponse.json(
      redactMoney(
        {
          ...person,
          dayPrice: toNumber(person.dayPrice),
          functions: (withUpdatedRates ?? person).functions.map(serializePersonFunction),
        },
        access,
      ),
    );
  } catch (err) {
    return serverError((err as Error).message);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const access = await requireModule("personen", "verwijderen").catch(() => null);
  if (!access) return forbidden();
  if (access.scope === "own") return forbidden();

  try {
    const { id } = await params;
    await prisma.person.delete({ where: { id: parseInt(id) } });
    return NextResponse.json({ success: true });
  } catch (err) {
    return serverError((err as Error).message);
  }
}
