# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev              # Start dev server (Turbopack)
npm run build            # Production build
npx tsc --noEmit         # Type-check — must pass with zero errors
npm run lint             # ESLint

# SQLite dev database (no Docker needed for local dev)
npm run db:dev:migrate   # Push schema changes to SQLite dev DB (prisma db push)
npm run db:dev:reset     # Drop + recreate dev DB and re-seed (prisma db push --force-reset && seed)
npm run db:dev:seed      # Run seed only (tsx prisma/seed.ts)
npm run db:dev:generate  # Re-generate Prisma client from schema.dev.prisma
npm run db:dev:studio    # Open Prisma Studio against the dev DB
```

Local dev setup: copy `.env.local.example` to `.env.local` — it points `DATABASE_URL` at the local SQLite file.

## Authoring Postgres migrations

Dev uses `prisma db push` (schema-driven, no migration files). Production migrations live in `prisma/migrations/` and are authored against the Postgres schema **without a local shadow DB**:

```bash
# 1. Start the compose Postgres service
docker compose up -d db

# 2. Diff current migrations against the updated schema to produce a new migration SQL
npx prisma migrate diff \
  --from-migrations prisma/migrations \
  --to-schema-datamodel prisma/schema.prisma \
  --shadow-database-url "postgresql://rentflow:rentflow@localhost:5432/rentflow" \
  --script > prisma/migrations/$(date +%Y%m%d%H%M%S)_<name>/migration.sql

# 3. Validate the migration applies cleanly
docker compose run --rm app sh -c "npx prisma migrate deploy"
```

Always author migrations against `prisma/schema.prisma` (Postgres). Never edit `migration_lock.toml` manually.

## Architecture

Single Next.js 16 app (App Router). No separate frontend or backend process.

```
src/
├── proxy.ts                  # Edge route guard (jose — NOT middleware.ts)
├── app/
│   ├── (auth)/login/         # Public page — no sidebar
│   ├── (app)/                # Protected pages — shared sidebar layout
│   │   ├── page.tsx          # Dashboard
│   │   ├── projects/
│   │   ├── people/
│   │   ├── materials/
│   │   └── planning/
│   └── api/                  # Route Handlers (Node runtime)
│       ├── auth/{login,register,logout}/
│       ├── projects/[id]/
│       ├── people/[id]/
│       ├── materials/[id]/
│       └── bookings/{person,material}/[id]/
├── components/
│   ├── ui/                   # shadcn/ui — never edit
│   ├── sidebar.tsx           # Server Component
│   └── logout-button.tsx     # "use client"
├── lib/
│   ├── prisma.ts             # globalThis singleton (HMR safe)
│   ├── auth.ts               # signToken/verifyToken (jsonwebtoken, Node only)
│   ├── api-auth.ts           # requireAuth() + response helpers
│   └── utils.ts              # cn(), statusVariant()
├── hooks/                    # Custom React hooks
├── providers/query-provider.tsx
└── types/index.ts            # All domain types
```

## Next.js 16 Breaking Changes

**`proxy.ts` not `middleware.ts`**: The middleware file convention is now `src/proxy.ts` and the exported function must be named `proxy` (not `middleware`). The old name triggers a deprecation warning.

**Async dynamic params**: Route handler params are a `Promise` in Next.js 16:
```typescript
type Params = { params: Promise<{ id: string }> };
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
```

**Tailwind v4**: No `tailwind.config.ts`. All theme config lives in `src/app/globals.css` via `@theme inline { ... }` OKLCH CSS variables. The `components.json` `tailwind.config` field is intentionally empty.

## Auth Flow

1. `proxy.ts` (Edge runtime) — uses `jose` `jwtVerify` to check the `rentflow_token` httpOnly cookie; redirects to `/login` on failure. **Never use `jsonwebtoken` here** — it calls Node.js crypto APIs that don't exist in the Edge runtime.
2. API route handlers (Node runtime) — call `requireAuth()` from `src/lib/api-auth.ts` which reads the same cookie via `next/headers`.
3. Cookie attributes: `httpOnly`, `secure` (prod only), `sameSite: "lax"`, `maxAge: 604800`.

## Two Prisma Schemas

| File | Provider | When used |
|---|---|---|
| `prisma/schema.prisma` | PostgreSQL | Production / Docker / CI |
| `prisma/schema.dev.prisma` | SQLite | Local dev (no Docker needed) |

Production migrations use `prisma migrate deploy` (run automatically by Docker CMD). Dev uses `prisma db push` via the `npm run db:dev:*` scripts — no migration files on the SQLite side.

## Key Conventions

- **150-line file limit** — extract components, hooks, or lib helpers when a file approaches this.
- All domain types live in `src/types/index.ts` — never define entity interfaces inline.
- Pages in `(app)/` are `"use client"` — they use TanStack Query hooks. Layouts stay as Server Components.
- All forms use React Hook Form + Zod. Form components live in `src/components/`.
- No `useEffect` + `useState` for data fetching — use `useQuery`.
- Every API route handler calls `requireAuth()` first and uses response helpers from `api-auth.ts` (never inline `NextResponse.json({error:...}, {status:400})`).
- Auth is cookie-based — never touch `localStorage` for auth state.

## Skills

Project-specific Claude Code skills live in `.claude/skills/`:

| Skill | When to use |
|---|---|
| `code` | Writing or reviewing any code in this project |
| `design` | Any UI/visual change (shadcn/ui token rules, WCAG contrast) |
| `cicd` | Changes to workflows, Dockerfile, or docker-compose.yml |
| `expand` | Planning a new feature before writing any code |

## Docker

Single image: `thewizard2026/rentflow`. Multi-stage Dockerfile (deps → builder → runner). Startup command: `prisma migrate deploy && node server.js`. Local docker-compose has 2 services: `db` (postgres:15) and `app`.
