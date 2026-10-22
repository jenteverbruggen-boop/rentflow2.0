---
name: code
description: Write and review code for this Next.js 16 project at senior/founder level. Enforce file size limits, permission checks, the money rule, TanStack Query conventions and tests. Triggers on: "write this", "implement", "refactor", "clean up", "add feature", "fix bug".
when_to_use: Every time code is written or modified. Use before finalising any implementation.
allowed-tools: Read Grep Bash(find *) Bash(npx tsc *) Bash(npm run lint) Bash(npm test) Bash(npx vitest *)
---

# Code Skill — RentFlow

CLAUDE.md already covers the folder layout, Next.js 16 changes, auth flow and
the money rule. This skill adds the patterns to follow when writing code.

## Stack

Next.js 16 App Router · React 19 · TypeScript 5 strict · **Prisma 7** (client
generated into `src/generated/prisma`, driver adapters `pg` / `libsql`) ·
TanStack Query v5 · React Hook Form + **Zod 4** · shadcn/ui · Vitest 4.

## File size

**Hard limit: 150 lines per file.** When a file gets close to it, split it:

1. Form state → `<EntityForm>` in `src/components/`
2. Fetch/mutation logic → `use-*.ts` hook in `src/hooks/`
3. Business logic → pure helper in `src/lib/` (and unit-test it there)
4. Large page → sub-components next to it (`projects/columns.tsx`)

Exceptions: `src/components/ui/*`, `src/generated/**`, Prisma schemas,
`src/types/index.ts` (all domain types live there by rule), and tests. Some
older files (`project-form.tsx`, `client-form.tsx`, …) are already over the
limit. Don't make them longer; split them when you touch them.

## API route handlers

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModule, forbidden, badRequest, notFound, serverError } from "@/lib/api-auth";
import { redactMoney } from "@/lib/redact";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const access = await requireModule("materialen", "lezen").catch(() => null);
  if (!access) return forbidden();
  const { id } = await params;
  try {
    const row = await prisma.material.findUnique({ where: { id: Number(id) } });
    if (!row) return notFound();
    return NextResponse.json(redactMoney(serializeMaterial(row), access));
  } catch (err) {
    return serverError((err as Error).message);
  }
}
```

- **Permissions:** call `requireModule(moduleKey, level)` first. The levels are
  `geen < lezen < wijzigen < verwijderen` and the module keys are in
  `src/lib/modules.ts`. Only session-level routes (`auth/me`, the
  `settings/company|logo` reads) use bare `requireAuth()` → `unauthorized()`.
- **`scope: own`** (freelancers) is read-only unless the route passes
  `{ allowOwnWrite: true }`. When that flag is set, the route has to limit
  itself to the caller's own records. Freelancers never see money: run
  responses through `redactMoney()`, or check `moneyVisible(access)` from
  `src/lib/redact.ts`.
- **Money:** never return a raw Prisma `Decimal`. Convert it with `toNumber()`
  / `toNumberOrNull()` (`src/lib/serialize.ts`) or an existing `serialize*`
  mapper. Dev and CI run on SQLite, where the field is a `Float`, so this bug
  only shows up in production.
- Use the response helpers (`unauthorized`, `forbidden`, `badRequest`,
  `notFound`, `conflict(msg, extra?)`, `serverError`). Don't construct
  `NextResponse.json({ error }, { status })` inline.
- Reads need `lezen`, writes need `wijzigen`, deletes need `verwijderen`.

## Client data

- Pages in `(app)/` are `"use client"`. Layouts, the sidebar and static shells
  are Server Components. Only the interactive leaf gets `"use client"`.
- Data access goes through hooks in `src/hooks/` (`useMaterials`, `useInvoice`,
  …). Don't put `useQuery` in a page unless the query is used only there.
- In a fetcher, check `res.ok` and throw `new Error(data.error ?? "Mislukt")`
  so `onError` can show the API's Dutch message.
- Query keys are flat arrays. Ids in keys are **strings**:
  `["project", String(id)]`. If you invalidate with a number key, the cached
  string key doesn't match and the data stays stale.
- After a mutation, invalidate every key that shows the changed data. For
  example, changing a booking affects `["project", id]`, the planning keys and
  `["materials"]`.

## Forms

React Hook Form + `zodResolver` + shadcn `Form` / `FormField` / `FormItem` /
`FormLabel` / `FormControl` / `FormMessage`, inside a `Dialog`. In edit mode,
reset the form when `defaultValues` changes:
`useEffect(() => form.reset(...), [defaultValues, form])`. This is the one
`useEffect` that's allowed. Validation messages are Dutch (`"Verplicht"`).

## TypeScript

- Put domain types in `src/types/index.ts`. Never define an entity interface
  inline in a component.
- No `any`. Use `unknown` and narrow it, or cast with a comment explaining why.
- Use `type` for data shapes. Use `interface` only when something extends it.
- Type fetch results at the boundary: `res.json() as Promise<Entity[]>`.

## Tests (Vitest)

- `src/lib/*.test.ts`: pure unit tests. Put logic in pure helpers so it can be
  tested this way.
- `src/lib/*.integration.test.ts`: each test pushes `schema.dev.prisma` into its
  own temp SQLite DB and mocks `@/lib/prisma`. Copy the setup from an existing
  integration test. Use these for anything that touches transactions,
  locking or invoices.
- `npm run test:postgres`: tests that need real Postgres (invoice numbering).
- Hook tests need `// @vitest-environment jsdom`. Don't test Radix `<Select>`
  under jsdom (it hangs). Test the logic, not the component.
- `npm run qa`: a Playwright click-through against a fresh seeded build. Run it
  after changes to flows it covers (see `qa/README.md`).

## Don't

- `useEffect` + `useState` for fetching. Use `useQuery`.
- `localStorage` for auth state (theme preference is fine).
- `axios`. Use native `fetch`.
- Hand-rolled modals (`fixed inset-0`). Use `Dialog` / `Sheet`.
- `export default` for utilities. Use named exports.
- Comments that explain *what* the code does. Comments that explain *why*
  (invariants, prod-only pitfalls) are welcome.
- `+` on a `*Price` / `*Snapshot` / `*Cost` wire value. ESLint blocks it; don't
  silence the rule.

## Verify after every change

```bash
npx tsc --noEmit && npm run lint && npm test
```
