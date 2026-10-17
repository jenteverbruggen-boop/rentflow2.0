import { NextRequest, NextResponse } from "next/server";
import { jwtVerify, SignJWT } from "jose";
import { JWT_SECRET_BYTES } from "@/lib/env";
import {
  AUTH_COOKIE,
  JWT_ALGORITHM,
  JWT_AUDIENCE,
  JWT_ISSUER,
  SESSION_RENEW_AFTER_SECONDS,
  SESSION_SECONDS,
  isSecureRequest,
  sessionCookieOptions,
} from "@/lib/auth-config";

const PUBLIC_PATHS = ["/login"];
// O1.2 — /api/calendar/[token] is token-authenticated (the token itself
// is the credential), not cookie-authenticated: it must never redirect a
// calendar client to /login the way an unauthenticated browser tab does.
// Pinned as this exact prefix — N2.5/N5.4's forward-registered entries
// reference it byte-for-byte.
const PUBLIC_API_PREFIXES = ["/api/auth", "/api/calendar/"];

/** API callers (fetch) need a 401 they can act on — a redirect to the HTML
 * login page just breaks their JSON parsing. Pages still redirect. */
function deny(request: NextRequest, clearCookie: boolean) {
  const response = request.nextUrl.pathname.startsWith("/api/")
    ? NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    : NextResponse.redirect(new URL("/login", request.url));
  if (clearCookie) response.cookies.delete(AUTH_COOKIE);
  return response;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p)))
    return NextResponse.next();
  if (PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p)))
    return NextResponse.next();

  const token = request.cookies.get(AUTH_COOKIE)?.value;
  if (!token) {
    console.warn("[proxy] no auth cookie", { pathname });
    return deny(request, false);
  }

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET_BYTES, {
      algorithms: [JWT_ALGORITHM],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });
    const response = NextResponse.next();

    // Sliding session: an active user is never logged out at day 7. Once
    // the token is past half its life, re-sign the same claims for a fresh
    // full window. Revocation is unaffected — `tv` is carried over and
    // still checked against the DB by requireAuth().
    const age = Math.floor(Date.now() / 1000) - (payload.iat ?? 0);
    if (age > SESSION_RENEW_AFTER_SECONDS) {
      const { id, email, name, tv } = payload as Record<string, unknown>;
      const renewed = await new SignJWT({ id, email, name, tv })
        .setProtectedHeader({ alg: JWT_ALGORITHM })
        .setIssuedAt()
        .setIssuer(JWT_ISSUER)
        .setAudience(JWT_AUDIENCE)
        .setExpirationTime(`${SESSION_SECONDS}s`)
        .sign(JWT_SECRET_BYTES);
      response.cookies.set(
        AUTH_COOKIE,
        renewed,
        sessionCookieOptions(isSecureRequest(request)),
      );
    }
    return response;
  } catch (err) {
    console.warn("[proxy] invalid/expired auth cookie", {
      pathname,
      message: (err as Error).message,
    });
    return deny(request, true);
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icon-192.png|icon-512.png|api/settings/logo).*)",
  ],
};
