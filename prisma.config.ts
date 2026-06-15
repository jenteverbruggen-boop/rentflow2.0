import { existsSync, readFileSync } from "node:fs";
import { defineConfig } from "prisma/config";

// Prisma 7 moved the connection URL out of schema.prisma. The CLI/Migrate
// (e.g. `prisma migrate deploy`) reads it from here; the app itself connects
// through a driver adapter in src/lib/prisma.ts.
//
// In production DATABASE_URL is already in the environment (Docker env_file),
// so this loader is skipped. Locally we hydrate it from .env.local / .env
// without pulling in a dotenv dependency (keeps the slim Docker runner clean).
if (!process.env.DATABASE_URL) {
  for (const file of [".env.local", ".env"]) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*?)\s*$/);
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
      }
    }
  }
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx --env-file=.env.local prisma/seed.ts",
  },
  // Read directly from the environment (not the `env()` helper) so commands
  // that don't connect — e.g. `prisma generate` during the Docker build — work
  // even when DATABASE_URL is absent. `migrate deploy` runs with it set.
  datasource: {
    url: process.env.DATABASE_URL ?? "",
  },
});
