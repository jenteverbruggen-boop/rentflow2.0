import jwt from "jsonwebtoken";
import { env } from "@/lib/env";

const JWT_SECRET = env.JWT_SECRET;

export interface TokenPayload {
  id: number;
  email: string;
  name: string;
  role?: string;
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, JWT_SECRET) as TokenPayload;
}
