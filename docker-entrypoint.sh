#!/bin/sh
set -e

PRISMA="node node_modules/prisma/build/index.js"

# Try a normal migrate deploy first (works for fresh DBs and for DBs that
# already have a migration history). If it fails — most likely because the
# tables already exist from a pre-migration deployment — resolve the baseline
# migration as "already applied" and retry; that is a no-op from that point on.
if ! $PRISMA migrate deploy 2>&1; then
  echo "migrate deploy failed — attempting to baseline existing schema as 0001_init"
  $PRISMA migrate resolve --applied 0001_init
  $PRISMA migrate deploy
fi

exec node server.js
