# RentFlow 2.0 — Copilot Instructions

## Project Overview

RentFlow 2.0 is a rental/planning tool for managing **projects**, **people**, **materials**, and **bookings**. It prevents double-booking of people and over-allocation of material stock across overlapping project date ranges.

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| UI | React 19, shadcn/ui, Tailwind CSS v4 |
| Data fetching | TanStack Query v5 |
| Forms | React Hook Form + Zod |
| ORM | Prisma 5 |
| Auth | JWT in httpOnly cookie (`jose` at Edge, `jsonwebtoken` in Node routes) |
| Containerisation | Docker multi-stage standalone build |
| CI/CD | GitHub Actions → Docker Hub (`thewizard2026/rentflow`) |

## Repository Layout

```
rentflow2.0/
├── prisma/
│   ├── schema.prisma         # PostgreSQL — production
│   └── schema.dev.prisma     # SQLite — local dev
├── src/
│   ├── proxy.ts              # Edge route guard (NOT middleware.ts)
│   ├── app/
│   │   ├── (auth)/login/     # Public pages
│   │   ├── (app)/            # Protected pages + sidebar layout
│   │   └── api/              # Route Handlers
│   ├── components/ui/        # shadcn/ui — never edit
│   ├── lib/                  # prisma.ts, auth.ts, api-auth.ts, utils.ts
│   ├── providers/            # QueryClientProvider
│   └── types/index.ts        # All domain types
├── Dockerfile
├── docker-compose.yml
└── .github/workflows/        # ci.yml, builds.yml, release.yml
```

## Critical Rules

- **`proxy.ts` not `middleware.ts`**: Next.js 16 deprecated the `middleware` file convention. Use `src/proxy.ts` with a function named `proxy`.
- **Async params**: Dynamic route params are `Promise<{id: string}>` in Next.js 16 — always `await params`.
- **Edge vs Node JWT**: Use `jose` in `proxy.ts` (Edge runtime). Use `jsonwebtoken` in API route handlers (Node runtime). Never mix.
- **No `tailwind.config.ts`**: Tailwind v4 config is CSS-only via `@theme inline` in `globals.css`.
- **150-line limit**: Extract sub-components, hooks, or lib helpers when a file approaches 150 lines.
- **No `localStorage` for auth**: Auth state is httpOnly cookie only. No client-side token storage.
- **No `useEffect` + `useState` for fetching**: Use `useQuery` from TanStack Query.
- **shadcn semantic tokens only**: Never use raw Tailwind palette colors (`bg-gray-900`). Use `bg-card`, `text-foreground`, `border-border`, etc.

## API Route Handler Pattern

```typescript
import { requireAuth, unauthorized, badRequest, serverError } from "@/lib/api-auth";

export async function GET() {
  const user = await requireAuth().catch(() => null);
  if (!user) return unauthorized();
  try {
    const data = await prisma.entity.findMany();
    return NextResponse.json(data);
  } catch (err) {
    return serverError((err as Error).message);
  }
}
```

## Dev Commands

```bash
npm run dev                # Start dev server
npx tsc --noEmit           # Type-check (must be zero errors)
npm run db:dev:migrate     # Create/migrate SQLite dev DB
npm run db:dev:studio      # Open Prisma Studio (SQLite)
```
