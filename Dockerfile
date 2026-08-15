FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

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
# Prisma 7's config loader (@prisma/config) depends on `effect` and ~20 other
# packages not traced by Next.js standalone. Copy full builder node_modules —
# the standalone traced set is a subset so overwriting is safe.
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x docker-entrypoint.sh
USER node
EXPOSE 3000
# Entrypoint handles both fresh DBs (apply migration) and existing DBs that
# predate migration history (baseline 0001_init then deploy).
CMD ["./docker-entrypoint.sh"]
