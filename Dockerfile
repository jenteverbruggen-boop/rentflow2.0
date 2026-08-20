FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
# src/lib/env.ts validates DATABASE_URL/JWT_SECRET at module import time, and
# `next build`'s page-data-collection step imports every route module
# (including ones that only reach @/lib/auth or @/lib/prisma indirectly),
# so the build itself needs *some* value here even though neither is ever
# read at runtime from this stage — the real values come from the runner
# container's actual environment. Same placeholders ci.yml's `next build`
# step uses, kept out of the final image since this whole stage is discarded.
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"
ENV JWT_SECRET="docker-build-placeholder-secret-unused-at-runtime"
RUN npm run build

# Isolated install of just the `prisma` CLI package for docker-entrypoint.sh's
# `prisma migrate deploy` — needed because that script runs as a separate
# process, never imported by app code, so Next's file-tracing for
# `.next/standalone` (below) never picks it up. A previous version of this
# Dockerfile worked around that by copying the *entire* builder node_modules
# (dependencies + devDependencies, untraced) over the runner's, which dragged
# in typescript/eslint/vitest/tailwind and full-size copies of next/react/etc
# that standalone's own tracing had already shrunk — ballooning the image to
# ~1.5GB. Installing `prisma` fresh in an empty directory instead lets npm
# resolve exactly its own dependency closure (@prisma/config, effect, the
# schema-engine binary, …), without any of that.
FROM node:22-alpine AS prisma-cli
WORKDIR /app
# Copied under a different name so it's never treated as *this* directory's
# own package.json — `npm install prisma@x` in a directory whose
# package.json already lists next/react/etc as dependencies installs that
# entire tree too (there is no node_modules yet to reuse), not just prisma.
# Reading the version out of it, then starting from a throwaway `npm init
# -y` manifest, is what keeps this stage down to prisma's own closure.
COPY package.json ./main-package.json
RUN PRISMA_VERSION=$(node -p "require('./main-package.json').dependencies.prisma") \
  && rm main-package.json \
  && npm init -y >/dev/null \
  && npm install "prisma@${PRISMA_VERSION}" --omit=dev

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# node:22-alpine ships a built-in `node` user/group (uid 1000); every COPY
# below is --chown=node:node so the app can run as that user, not root.
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/prisma ./prisma
COPY --from=builder --chown=node:node /app/prisma.config.ts ./prisma.config.ts
# Merges into (does not replace) the node_modules that .next/standalone
# already populated above — Docker COPY unions directory contents. Next's
# tracing already put @prisma/client + the pg/libsql driver adapters app
# code actually imports in there; this adds only the CLI's own closure.
COPY --from=prisma-cli --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x docker-entrypoint.sh
USER node
EXPOSE 3000
# Entrypoint handles both fresh DBs (apply migration) and existing DBs that
# predate migration history (baseline 0001_init then deploy).
CMD ["./docker-entrypoint.sh"]
