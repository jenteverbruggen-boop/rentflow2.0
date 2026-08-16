import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { JWT_SECRET_BYTES } from "@/lib/env";

const PUBLIC_PATHS = ["/login"];
// O1.2 — /api/calendar/[token] is token-authenticated (the token itself
// is the credential), not cookie-authenticated: it must never redirect a
// calendar client to /login the way an unauthenticated browser tab does.
// Pinned as this exact prefix — N2.5/N5.4's forward-registered entries
// reference it byte-for-byte.
const PUBLIC_API_PREFIXES = ["/api/auth", "/api/calendar/"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p)))
    return NextResponse.next();
  if (PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p)))
    return NextResponse.next();

  const token = request.cookies.get("rentflow_token")?.value;
  if (!token) return NextResponse.redirect(new URL("/login", request.url));

  try {
    await jwtVerify(token, JWT_SECRET_BYTES);
    return NextResponse.next();
  } catch {
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.delete("rentflow_token");
    return response;
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icon-192.png|icon-512.png|api/settings/logo).*)",
  ],
};
