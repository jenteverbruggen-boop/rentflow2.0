import { NextResponse } from "next/server";
import { requireModule, forbidden, serverError } from "@/lib/api-auth";
import { listAssignablePeople } from "@/lib/note-assignees";

/** GET /api/notes/assignable-people — id + name of everyone a note can be
 * handed to. A slim list of its own, because GET /api/people needs the
 * `personen` module (and returns money fields); whoever may write notes must
 * be able to pick an assignee without that. */
export async function GET() {
  const access = await requireModule("notities", "wijzigen").catch(() => null);
  if (!access) return forbidden();
  if (access.scope === "own") return forbidden();
  try {
    return NextResponse.json(await listAssignablePeople());
  } catch (err) {
    return serverError((err as Error).message);
  }
}
