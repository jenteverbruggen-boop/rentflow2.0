/**
 * Edge-safe auth constants + cookie helpers, shared by proxy.ts (Edge,
 * `jose`) and auth.ts (Node, `jsonwebtoken`). No Node-only imports here.
 */
export const AUTH_COOKIE = "rentflow_token";
export const JWT_ALGORITHM = "HS256";
export const JWT_ISSUER = "rentflow";
export const JWT_AUDIENCE = "rentflow-app";
export const SESSION_SECONDS = 60 * 60 * 24 * 7;
/** The proxy re-issues the cookie once the token is older than this. */
export const SESSION_RENEW_AFTER_SECONDS = SESSION_SECONDS / 2;
export const BCRYPT_COST = 12;

/**
 * Whether the auth cookie should carry the `Secure` attribute, derived from
 * the request's own protocol (`X-Forwarded-Proto` first) rather than
 * NODE_ENV: a production deployment reached over plain HTTP (a phone on the
 * LAN) silently drops a `Secure` cookie, so every login would bounce.
 */
export function isSecureRequest(req: {
  headers: { get(name: string): string | null };
  nextUrl: { protocol: string };
}): boolean {
  const forwardedProto = req.headers.get("x-forwarded-proto");
  if (forwardedProto) return forwardedProto.split(",")[0].trim() === "https";
  return req.nextUrl.protocol === "https:";
}

export function sessionCookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    maxAge: SESSION_SECONDS,
    path: "/",
  };
}
