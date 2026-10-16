import type { Prisma } from "@/generated/prisma/client";
import { scopeFilter, type ScopeAccess } from "@/lib/scope-filter";

export interface NoteFilter {
  projectId?: number;
  clientId?: number;
  /** Notes not linked to any project or client ("Niet gekoppeld"). */
  unassigned?: boolean;
  q?: string;
  /** Notes assigned to the caller's own person. */
  assignedToMe?: boolean;
  /** Together with `assignedToMe`: only those the caller hasn't ticked off. */
  open?: boolean;
  /** Notes assigned to this person (managers filtering per colleague). */
  assigneeId?: number;
}

/** `-1` never matches a person — the same sentinel `scopeFilter` uses. Left
 * as `undefined`, Prisma would drop the condition and match every assigned
 * note for a caller who has no linked person. */
export function myPersonId(access: ScopeAccess): number {
  return access.personId ?? -1;
}

/**
 * What a `scope: own` caller may see: notes on a project they're booked on
 * (own-data-scoping-design.md) **or** notes explicitly assigned to them —
 * assigning is a deliberate share, whatever the note is linked to.
 */
export function noteVisibility(access: ScopeAccess): Prisma.NoteWhereInput | undefined {
  if (access.scope !== "own") return undefined;
  return {
    OR: [
      { project: scopeFilter(access) },
      { assignees: { some: { personId: myPersonId(access) } } },
    ],
  };
}

/**
 * The list query. Every clause goes into `AND` so none can overwrite another:
 * the search term used to own `where.OR`, and an own-scope visibility `OR`
 * written the same way would have been silently replaced by it, handing a
 * freelancer every note that matches their search.
 */
export function buildNoteWhere(filter: NoteFilter, access: ScopeAccess): Prisma.NoteWhereInput {
  const and: Prisma.NoteWhereInput[] = [];
  const visibility = noteVisibility(access);
  if (visibility) and.push(visibility);

  if (access.scope === "own") {
    // Linked-to-nothing and client views have no per-project ownership a
    // scoped caller could be checked against; `projectId` may only narrow
    // within what they can already see.
    if (filter.projectId != null) and.push({ projectId: filter.projectId });
  } else if (filter.unassigned) {
    and.push({ projectId: null, clientId: null });
  } else if (filter.projectId != null) {
    and.push({ projectId: filter.projectId });
  } else if (filter.clientId != null) {
    and.push({ clientId: filter.clientId });
  }

  if (filter.assignedToMe) {
    and.push({
      assignees: { some: { personId: myPersonId(access), ...(filter.open ? { doneAt: null } : {}) } },
    });
  }
  if (filter.assigneeId != null && access.scope !== "own") {
    and.push({ assignees: { some: { personId: filter.assigneeId } } });
  }

  if (filter.q) {
    // No `mode: "insensitive"` — Postgres/Mongo-only in Prisma and it throws
    // on the SQLite dev schema; every other search filter here skips it too.
    and.push({ OR: [{ title: { contains: filter.q } }, { body: { contains: filter.q } }] });
  }
  return and.length > 0 ? { AND: and } : {};
}
