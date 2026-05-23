---
name: code
description: Write and review code for this Next.js 16 project at senior/founder level. Enforce file size limits, proper React patterns, TypeScript strictness, and TanStack Query conventions. Triggers on: "write this", "implement", "refactor", "clean up", "add feature", "fix bug".
when_to_use: Every time code is written or modified. Use before finalising any implementation.
allowed-tools: Read Grep Bash(find *) Bash(npx tsc *) Bash(npm run lint)
---

# Code Skill — RentFlow

## Stack context

- **Next.js 16** App Router (Turbopack in dev)
- **React 19** with `"use client"` only where client interactivity is needed
- **TypeScript 5** strict mode — `noEmit` must pass with zero errors
- **Prisma 5** with a PostgreSQL schema (`prisma/schema.prisma`) and SQLite dev schema (`prisma/schema.dev.prisma`)
- **TanStack Query v5** for all client-side async state
- **React Hook Form + Zod** for all forms
- **shadcn/ui** for all UI components

## File size rule

**Hard limit: 150 lines per file.** If a file approaches this:

1. Extract inline form state into a dedicated `<EntityForm>` component in `src/components/`
2. Extract repeated fetch logic into a custom hook in `src/hooks/`
3. Extract complex business logic into a `src/lib/` helper
4. Split a large page into sub-components co-located next to it, e.g. `projects/columns.tsx`, `projects/filters.tsx`

The only exceptions are auto-generated files (`src/components/ui/*`) and the Prisma schema.

## File structure conventions

```
src/
├── app/
│   ├── (auth)/         # Public route group — no sidebar
│   ├── (app)/          # Protected route group — has sidebar
│   │   └── feature/
│   │       ├── page.tsx            # ≤ 150 lines
│   │       └── feature-card.tsx    # sub-component if needed
│   └── api/feature/route.ts        # Route handler
├── components/
│   ├── ui/             # shadcn/ui — never edit
│   └── feature-form.tsx            # Reusable Dialog forms
├── lib/
│   ├── prisma.ts       # Singleton
│   ├── auth.ts         # JWT sign/verify (Node runtime only)
│   ├── api-auth.ts     # requireAuth() + response helpers
│   └── utils.ts        # cn(), statusVariant()
├── hooks/              # Custom React hooks (use-*.ts)
├── providers/          # Context providers
├── types/index.ts      # All shared domain types
└── proxy.ts            # Route guard (Edge runtime — jose only)
```

## API route handlers

Every Route Handler follows this exact pattern:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, unauthorized, badRequest, serverError } from "@/lib/api-auth";

export async function GET() {
  const user = await requireAuth().catch(() => null);
  if (!user) return unauthorized();

  try {
    const data = await prisma.entity.findMany({ orderBy: { name: "asc" } });
    return NextResponse.json(data);
  } catch (err) {
    return serverError((err as Error).message);
  }
}
```

Rules:
- Always `requireAuth()` first, return `unauthorized()` if null
- Catch every async block and return `serverError()`
- Use response helpers from `api-auth.ts` — never construct `NextResponse.json({error:...}, {status:...})` inline
- Dynamic params are `Promise<{id: string}>` in Next.js 16 — always `await params`

## Client pages

Every `page.tsx` in `(app)/` follows this pattern:

```typescript
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// Query keys are flat arrays: ['projects'], ['project', id], ['people'], ['materials']
const { data = [] } = useQuery({
  queryKey: ["entities"],
  queryFn: () => fetch("/api/entities").then(r => r.json()),
});

const { mutate, isPending } = useMutation({
  mutationFn: (body: EntityFormValues) =>
    fetch("/api/entities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(async r => {
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Mislukt");
      return data;
    }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["entities"] });
    setOpen(false);
  },
  onError: (err) => setApiError((err as Error).message),
});
```

Rules:
- Pages are `"use client"` — they use hooks
- Layouts are Server Components by default — no `"use client"` unless they use hooks
- Sidebar and static layout shells stay as Server Components
- Only the interactive leaf (`LogoutButton`, forms) needs `"use client"`

## Form components

All form components live in `src/components/` and use this structure:

```typescript
const schema = z.object({
  name: z.string().min(1, "Verplicht"),
  // ...
});

type FormValues = z.infer<typeof schema>;

export function EntityForm({ open, onOpenChange, defaultValues, onSubmit, isPending }: Props) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "" },
  });

  // Reset when defaultValues changes (edit mode)
  useEffect(() => {
    form.reset(defaultValues ? mapToForm(defaultValues) : emptyDefaults);
  }, [defaultValues, form]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>Naam *</FormLabel>
                <FormControl><Input {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            {/* ... */}
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
```

## TypeScript rules

- All domain types live in `src/types/index.ts` — never define entity interfaces inline in a component
- No `any` — use `unknown` and narrow, or cast explicitly with a comment
- Prefer `type` over `interface` for data shapes; use `interface` only for things that are extended
- API responses are typed: `fetch(...).then(r => r.json() as Promise<Entity[]>)` or validated at the boundary

## What NOT to do

- ❌ `useEffect` + `useState` for fetching — use `useQuery`
- ❌ Direct `localStorage` access — auth is cookie-based
- ❌ `import axios` — use native `fetch`
- ❌ Inline modal divs (`<div className="fixed inset-0...">`) — use `Dialog`
- ❌ `export default` for utility functions — use named exports
- ❌ Comments explaining WHAT code does — name things well instead
- ❌ Files over 150 lines without justification

## Verify after every change

```bash
npx tsc --noEmit   # zero errors required
```
