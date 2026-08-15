import { z } from "zod";

/**
 * Validate required environment variables once, at module load, instead of
 * deferring failure to first use. Before this: `process.env.JWT_SECRET!`
 * (auth.ts) threw only on the first sign/verify call; `new TextEncoder()
 * .encode(process.env.JWT_SECRET)` (proxy.ts, sidebar.tsx) silently encoded
 * the literal string "undefined" as a valid-looking key instead of throwing
 * at all; `process.env.DATABASE_URL ?? ""` (prisma.ts) fed an empty
 * connection string to the Postgres adapter, failing only on the first
 * query.
 *
 * Must stay Edge-safe: this module is imported from src/proxy.ts, which
 * runs on the Edge runtime. zod has no Node-only dependencies, so this is
 * safe — verified by `npm run build` succeeding (Edge bundling failures
 * for proxy.ts don't always surface as tsc errors).
 */
const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  // 16 chars is a floor, not a strength recommendation — chosen so CI's
  // placeholder ("ci-placeholder-secret", 21 chars) and the local dev
  // default ("local-dev-secret-change-in-production", 38 chars) both pass.
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters"),
});

const parsed = envSchema.safeParse({
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_SECRET: process.env.JWT_SECRET,
});

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `${i.path.join(".")}: ${i.message}`)
    .join("; ");
  throw new Error(`Invalid environment configuration — ${issues}`);
}

export const env = parsed.data;

/** Pre-encoded JWT secret bytes, shared by proxy.ts (Edge) and sidebar.tsx
 * (Node Server Component) so the TextEncoder call isn't duplicated. */
export const JWT_SECRET_BYTES = new TextEncoder().encode(env.JWT_SECRET);
