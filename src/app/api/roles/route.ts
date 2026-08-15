import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModule, forbidden, serverError } from "@/lib/api-auth";

// GET only for now (N1.5) — POST/PUT/DELETE land in N3.1, extending this
// same file rather than a second route.
export async function GET() {
  const auth = await requireModule("gebruikers", "lezen").catch(() => null);
  if (!auth) return forbidden();

  try {
    const roles = await prisma.role.findMany({
      select: { id: true, key: true, label: true },
      orderBy: { id: "asc" },
    });
    return NextResponse.json(roles);
  } catch (err) {
    return serverError((err as Error).message);
  }
}
