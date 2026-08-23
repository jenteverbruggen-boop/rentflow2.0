import {
  pickHighestRemovable,
  validateIdSelection,
  type BulkUnit,
} from "@/lib/stock-bulk";

/** A bulk removal is addressed either by count (the N highest unit
 * numbers) or by an explicit id selection — never both. */
export type RemovalRequest = { count: number } | { ids: number[] };

export type RemovalOutcome =
  | { kind: "ok"; ids: number[]; removedUnits: number[] }
  | { kind: "badRequest"; message: string }
  | {
      kind: "conflict";
      message: string;
      blockedUnits: number[];
      removable: number;
      removableFromTop: number;
    };

/**
 * Turns a removal request plus the material's current units into the
 * exact response the route should send — pure, so every branch is
 * testable without a database (dev/CI are SQLite-only).
 *
 * Lives beside stock-bulk.ts rather than inside the route handler so the
 * handler stays a thin transaction wrapper under the 150-line limit.
 */
export function resolveRemoval(
  units: BulkUnit[],
  req: RemovalRequest,
): RemovalOutcome {
  if ("count" in req) {
    const sel = pickHighestRemovable(units, req.count);
    if (sel.ids.length > 0) {
      return { kind: "ok", ids: sel.ids, removedUnits: sel.unitNumbers };
    }
    return {
      kind: "conflict",
      message: countMessage(req.count, units.length, sel.blockedUnits, sel.removableFromTop),
      blockedUnits: sel.blockedUnits,
      removable: sel.removable,
      removableFromTop: sel.removableFromTop,
    };
  }

  const sel = validateIdSelection(units, req.ids);
  if (sel.unknownIds.length > 0) {
    return {
      kind: "badRequest",
      message: `Deze unit-id's horen niet bij dit materiaal: ${sel.unknownIds.join(", ")}`,
    };
  }
  if (sel.blockedUnits.length > 0) {
    const full = pickHighestRemovable(units, 0);
    return {
      kind: "conflict",
      message: `Selectie verwijderen kan niet — ${sel.blockedUnits.length} unit(s) uit je selectie zijn nog geboekt (#${sel.blockedUnits.join(", #")}). Los die boekingen eerst op.`,
      blockedUnits: sel.blockedUnits,
      removable: full.removable,
      removableFromTop: full.removableFromTop,
    };
  }
  const numbers = units
    .filter((u) => sel.ids.includes(u.id))
    .map((u) => u.unitNumber)
    .sort((a, b) => a - b);
  return { kind: "ok", ids: sel.ids, removedUnits: numbers };
}

function countMessage(
  requested: number,
  total: number,
  blockedUnits: number[],
  removableFromTop: number,
) {
  if (blockedUnits.length === 0) {
    return `Er ${total === 1 ? "is" : "zijn"} maar ${total} unit(s) — ${requested} verwijderen kan niet.`;
  }
  const head = `${requested} units verwijderen kan niet — ${blockedUnits.length} unit(s) in die reeks zijn nog geboekt (#${blockedUnits.join(", #")}).`;
  return removableFromTop > 0
    ? `${head} Maximaal ${removableFromTop} unit(s) kunnen nu verwijderd worden, vanaf de hoogste.`
    : `${head} Los die boekingen eerst op.`;
}
