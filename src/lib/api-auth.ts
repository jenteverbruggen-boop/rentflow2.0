import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { verifyToken, type TokenPayload } from "./auth";
import { prisma } from "./prisma";

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
