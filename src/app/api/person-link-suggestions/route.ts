import { NextResponse } from "next/server";
import { requireModule, forbidden, serverError } from "@/lib/api-auth";
import { findPersonLinkSuggestions } from "@/lib/person-link-suggestions";

/**
 * Read-only: applying a suggestion goes through the existing
 * `PATCH /api/users/[id]`, which re-validates the person itself. Gated on
 * `gebruikers: lezen` because the payload pairs up user accounts with
 * people — the People page reads the same endpoint, and an admin who may
 * see people but not users has no business seeing that pairing.
 */
export async function GET() {
  const access = await requireModule("gebruikers", "lezen").catch(() => null);
  if (!access) return forbidden();
  try {
    return NextResponse.json(await findPersonLinkSuggestions());
  } catch (err) {
    return serverError((err as Error).message);
  }
}
