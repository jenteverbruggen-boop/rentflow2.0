#!/usr/bin/env bash
# Builds and serves a FRESH, seeded QA instance on 127.0.0.1:${PORT:-3100}.
# Uses qa/.out/qa.db only — never prisma/dev.db and never port 3000.
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$PWD"
OUT="$ROOT/qa/.out"
mkdir -p "$OUT"
rm -f "$OUT/qa.db" "$OUT/qa.db-journal" "$OUT"/state*.json
export DATABASE_URL="file:$OUT/qa.db"
export PORT="${PORT:-3100}"
export HOSTNAME=127.0.0.1
export JWT_SECRET="$(openssl rand -hex 32)"

npm run db:dev:generate
npx prisma db push --schema=prisma/schema.dev.prisma
npx tsx prisma/seed.ts
npm run build

rm -rf .next/standalone/.next/static
mkdir -p .next/standalone/.next
cp -R .next/static .next/standalone/.next/static
if [ -d public ]; then rm -rf .next/standalone/public; cp -R public .next/standalone/public; fi

exec node .next/standalone/server.js
