import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { verifyToken, type TokenPayload } from "./auth";

export async function requireAuth(): Promise<TokenPayload> {
  const cookieStore = await cookies();
  const token = cookieStore.get("rentflow_token")?.value;
  if (!token) throw new Error("Unauthorized");
  return verifyToken(token);
}

export function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
