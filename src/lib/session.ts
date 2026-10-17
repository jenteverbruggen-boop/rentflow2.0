import type { NextResponse } from "next/server";
import { signToken } from "@/lib/auth";
import { AUTH_COOKIE, sessionCookieOptions } from "@/lib/auth-config";

/** Sign a fresh session token for `user` and set it as the auth cookie. */
export function attachSession(
  response: NextResponse,
  user: { id: number; email: string; name: string; tokenVersion: number },
  secure: boolean,
) {
  const token = signToken({
    id: user.id,
    email: user.email,
    name: user.name,
    tv: user.tokenVersion,
  });
  response.cookies.set(AUTH_COOKIE, token, sessionCookieOptions(secure));
}

/** Best-effort client IP for log lines (only meaningful behind a proxy). */
export function clientIp(req: { headers: { get(n: string): string | null } }) {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? null;
}
