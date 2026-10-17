import jwt from "jsonwebtoken";
import { env } from "@/lib/env";
import {
  JWT_ALGORITHM,
  JWT_AUDIENCE,
  JWT_ISSUER,
  SESSION_SECONDS,
} from "@/lib/auth-config";

export { isSecureRequest } from "@/lib/auth-config";

const JWT_SECRET = env.JWT_SECRET;

export interface TokenPayload {
  id: number;
  email: string;
  name: string;
  /** User.tokenVersion at issue time — a bump on the row revokes the token. */
  tv: number;
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    algorithm: JWT_ALGORITHM,
    expiresIn: SESSION_SECONDS,
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  });
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, JWT_SECRET, {
    algorithms: [JWT_ALGORITHM],
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  }) as TokenPayload;
}
