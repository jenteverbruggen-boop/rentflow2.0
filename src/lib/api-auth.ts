import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { verifyToken, type TokenPayload } from "./auth";
import { prisma } from "./prisma";
import { satisfies } from "./modules";
import type { AccessLevel, ModuleKey } from "@/types";

export async function requireAuth(): Promise<TokenPayload> {
  const cookieStore = await cookies();
  const token = cookieStore.get("rentflow_token")?.value;
  if (!token) throw new Error("Unauthorized");
  return verifyToken(token);
}

export async function requireRole(...roles: string[]): Promise<TokenPayload> {
  const payload = await requireAuth();
  let role = payload.role;
  if (!role) {
    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      select: { role: true },
    });
    role = user?.role;
  }
  if (!role || !roles.includes(role)) throw new Error("Forbidden");
  return { ...payload, role };
}

/**
 * The resolved permission set for one request. `scope`/`personId` are not
 * read by anything until N5, but the shape is fixed now so N5 does not
 * need to widen every requireModule() call site later.
 */
export interface ResolvedAccess {
  id: number;
  personId: number | null;
  scope: "all" | "own";
  permissions: Partial<Record<ModuleKey, AccessLevel>>;
}

async function resolveAccess(userId: number): Promise<ResolvedAccess | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      personId: true,
      roleRel: {
        select: {
          scope: true,
          permissions: { select: { module: true, access: true } },
        },
      },
    },
  });
  // No user row, or roleId not pointing at a real role (legacy account,
  // or a backfill miss) — fail closed on every module, not just the one
  // being checked.
  if (!user || !user.roleRel) return null;

  const permissions: Partial<Record<ModuleKey, AccessLevel>> = {};
  for (const p of user.roleRel.permissions) {
    permissions[p.module as ModuleKey] = p.access as AccessLevel;
  }
  return {
    id: userId,
    personId: user.personId,
    scope: user.roleRel.scope === "own" ? "own" : "all",
    permissions,
  };
}

/**
 * Resolve the caller's module permissions from the database on every
 * call — no cache. A matrix change must apply on the next request, not
 * after re-login (7-day tokens). The JWT keeps carrying `role` for nav
 * rendering only (until N4.3 removes even that); it is never trusted for
 * authorisation here.
 */
export async function requireModule(
  module: ModuleKey,
  level: AccessLevel,
): Promise<ResolvedAccess> {
  const payload = await requireAuth();
  const access = await resolveAccess(payload.id);
  if (!access) throw new Error("Forbidden");
  const held = access.permissions[module] ?? "geen";
  if (!satisfies(held, level)) throw new Error("Forbidden");
  return access;
}

export function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function forbidden() {
  return NextResponse.json(
    { error: "Verboden — onvoldoende rechten" },
    { status: 403 },
  );
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function conflict(message: string) {
  return NextResponse.json({ error: message }, { status: 409 });
}

export function notFound() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

export function serverError(message: string) {
  return NextResponse.json({ error: message }, { status: 500 });
}
