import jwt from "jsonwebtoken";
import { env } from "@/lib/env";

const JWT_SECRET = env.JWT_SECRET;

export interface TokenPayload {
  id: number;
  email: string;
  name: string;
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, JWT_SECRET) as TokenPayload;
}

/**
 * Whether the auth cookie should carry the `Secure` attribute. Login/
 * logout used to gate this purely on `NODE_ENV === "production"` — not
 * a reliable signal on its own: this project's own docker-compose ships
 * with no TLS-terminating reverse proxy in front of the app (verified —
 * no nginx/caddy/traefik service), so a production deployment reached
 * over plain HTTP (e.g. `http://<lan-ip>:3000`, exactly how a phone on
 * the same network would hit it) had every login silently fail —
 * browsers drop a `Secure` cookie outright on a non-HTTPS connection,
 * with no visible error. The login POST still returns 200 with the
 * user object, but the cookie never lands in the jar, so the very next
 * request bounces straight back to /login. A desktop dev session
 * (`npm run dev`, NODE_ENV=development, `secure: false`) never hit
 * this, which is exactly the "works for me, not on my phone" shape.
 *
 * Derives the decision from the request's own protocol instead —
 * `X-Forwarded-Proto` first (set by a reverse proxy that *does*
 * terminate TLS, if one is ever put in front of this app), falling
 * back to the request's own scheme.
 */
export function isSecureRequest(req: {
  headers: { get(name: string): string | null };
  nextUrl: { protocol: string };
}): boolean {
  const forwardedProto = req.headers.get("x-forwarded-proto");
  if (forwardedProto) return forwardedProto.split(",")[0].trim() === "https";
  return req.nextUrl.protocol === "https:";
}
