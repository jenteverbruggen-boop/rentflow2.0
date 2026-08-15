# Phase 2 — PO items 1, 3 and 7: hours, rates, material import, cost document

> Read `00-README.md` first. Source decisions: `.plans/2026-08-po-feedback-round2.md` (Q17–Q19, Q30–Q33, Q34b, Q36a–c, Q22).
> **v2 — two adversarial review rounds folded in (10 findings, 1 high-severity compile break).**
> 9 items + 1 DDL commit, ~29 commits.
> **Gate to start:** phase 1 merged · **PO has retested H3/H4/J1 from phase 0** (the cheap fixes may already cover much of item 1).

## Order

```
DDL-2 (alone, first)
  ├─► L1 (function rates) ──► L2 (function at booking) ──► L3 (client rate cards)
  ├─► H1 (hours per booking) ──► H2 (overlap override)
  │        └─► H5/L5 (hourly billing)  [needs L1's rates + H1's windows]
  ├─► M1 (material import)              [independent]
  └─► J2a (cost document)               [independent]
```

**One worker owns `src/lib/pricing.ts`** for H5/L5. **One worker owns `src/lib/availability.ts`** for H1/H2. `src/lib/effective-price.ts` is owned by whoever does L1→L2→L3 — keep that chain with a single worker, since L3 slots into the resolution order L1 defines.

## Inherited obligations from phase 1

Phase 1 built a redaction layer and a guard test. Everything added here must satisfy them:

1. **Every new route needs a `requireModule(...)` guard** or N2.5's enumeration test fails. New routes in this phase: `functions` management additions, `clients/[id]/rates` (L3), the import endpoints (M1).
2. **Every new money field must be added to `src/lib/redact.ts`** (built in N2.1): `Function.dayRate`, `Function.hourRate`, `PersonFunction.dayRate/hourRate`, `ClientFunctionRate.dayRate/hourRate`, `Material.costPrice`, `Material.listPrice`, `Material.revenueBefore`, `StockItem.costPrice`, and the new rate snapshot on `PeriodPerson`. A freelancer with `Kosten/Facturen: geen` must not receive any of them.
3. **Resolve the `TODO(L1)` markers** left at `src/app/api/functions/route.ts` and `functions/[id]/route.ts` in N2.3 — that is L1.1's job.
4. **Every new money field must go through Y1's serializer** — never return a raw `Decimal`.

---

## DDL-2 — the shared migration `lands alone, first`

**Branch:** `ddl2-hours-rates-materials` · **one commit**

**`feat(db): add booking hours, function rates and material cost fields`**

Both `prisma/schema.prisma` (Decimal money) **and** `prisma/schema.dev.prisma` (Float money), plus `prisma/seed.ts`.

| Model | Change | For |
|---|---|---|
| `PeriodPerson` | `startAt DateTime?`, `endAt DateTime?` | H1 — null means "inherit the period window" |
| `PeriodPerson` | `overlapAck Boolean @default(false)` | H2 — marks a deliberately forced double booking |
| `PeriodPerson` | `functionId Int?` + relation to `Function` | L2 |
| `PeriodPerson` | `billingUnit String @default("dag")`, `rateSnapshot Decimal?` | H5/L5 — `dag`\|`uur`; `rateSnapshot` is the unit rate actually charged |
| `Function` | `dayRate Decimal?`, `hourRate Decimal?` | L1 — the company default |
| `PersonFunction` | `dayRate Decimal?`, `hourRate Decimal?` | L1 — the per-person override |
| `ClientFunctionRate` | **new**: `id, clientId, functionId, dayRate Decimal?, hourRate Decimal?, @@unique([clientId, functionId])` | L3 |
| `Material` | `archived Boolean @default(false)`, `costPrice Decimal?`, `listPrice Decimal?`, `revenueBefore Decimal?` | M1 + K4 |
| `StockItem` | `costPrice Decimal?` | K4 — optional per-unit override |
| **Inverse relation fields (mandatory)** | `Function.assignments PeriodPerson[]`, `Function.clientRates ClientFunctionRate[]`, `Client.functionRates ClientFunctionRate[]` | Prisma **fails schema validation** without the other side of each relation. `Function` today has only `id, name, people` (`prisma/schema.prisma:46-50`), so all three are new. Omitting them makes DDL-2's own `npm run db:dev:reset` verification fail. |

- `@@unique([periodId, personId])` on `PeriodPerson` **stays** (Q17 chose one window per person per period, not the shift model). Do not touch it.
- Keep `dayPriceSnapshot` as-is. `rateSnapshot` + `billingUnit` are additive so existing rows keep working; H5 decides the read precedence.
- **`src/types/index.ts` is this commit's responsibility too.** It is a hand-maintained mirror, not generated (`PeriodPerson` at `:196-206`). Add `startAt`, `endAt`, `overlapAck`, `functionId`, `billingUnit`, `rateSnapshot`, the `Function` rate fields, `ClientFunctionRate`, and the `Material`/`StockItem` additions here — otherwise H1.3, H2.2, L2.2 and H5.1 each guess which of them owns it.
- **Extract the CSV parsing helper out of `prisma/seed.ts` in this commit.** M1.1 is told to reuse the header-detection and dedup logic at `seed.ts:98-259`, but `seed.ts` belongs to the DDL owner (one-owner rule) — so the DDL worker moves that logic into `src/lib/` and makes `seed.ts` call it. M1.1 then only imports it and never edits the seed. Copy-pasting instead would duplicate exactly what this plan forbids elsewhere.
- Seed: give at least one seeded function a `hourRate`, give **one person two functions at different rates** (seed currently maps 1:1, `prisma/seed.ts:316-325`, so multi-function UI is otherwise untested), add one `ClientFunctionRate` row, and set `costPrice`/`revenueBefore` on a couple of materials so K4 has data in phase 3.
- **No behaviour change** — nothing reads the new columns yet.
- **Verify:** `npm run db:dev:reset` succeeds; `docker compose run --rm app sh -c "npx prisma migrate deploy"` applies cleanly against Postgres; existing bookings unaffected.

**DDL rollback protocol:** if this migration must change after feature workers have branched, issue a **new forward migration** and announce it. Never edit an applied migration. No feature worker starts before this commit is merged.

### Files to read before starting

| File | Why |
|---|---|
| `prisma/schema.prisma` (250 lines, read in full) | Postgres schema — every new field lands here as `Decimal` |
| `prisma/schema.dev.prisma` (250 lines, read in full) | SQLite dev mirror — verified line-for-line structurally identical to `schema.prisma` except `datasource.provider` (`:7`, `postgresql` vs `sqlite`) and money types (`Decimal @db.Decimal(10,2)` vs `Float`) |
| `prisma/seed.ts` (563 lines, read in full) | This commit extracts the CSV helper (`:31-79`) into `src/lib/`, and must seed the new fields |
| `src/types/index.ts` (280 lines, read in full) | Hand-maintained mirror — every new column needs a matching TS field or L1–M1 each guess its shape |

### Exact model blocks

**`prisma/schema.prisma` (Decimal money)** — full field lists for the six affected models, replacing the current blocks at their cited line ranges (`Client:21-33`, `Function:46-50`, `PersonFunction:52-59`, `Material:145-162`, `StockItem:164-174`, `PeriodPerson:227-240`):

```prisma
model Client {
  id            Int                  @id @default(autoincrement())
  name          String
  contactName   String?
  email         String?
  phone         String?
  address       String?
  postalCode    String?
  city          String?
  vatNumber     String?
  notes         String?
  projects      Project[]
  functionRates ClientFunctionRate[]
}

model Function {
  id          Int                  @id @default(autoincrement())
  name        String               @unique
  dayRate     Decimal?             @db.Decimal(10, 2)
  hourRate    Decimal?             @db.Decimal(10, 2)
  people      PersonFunction[]
  assignments PeriodPerson[]
  clientRates ClientFunctionRate[]
}

model PersonFunction {
  personId   Int
  functionId Int
  dayRate    Decimal? @db.Decimal(10, 2)
  hourRate   Decimal? @db.Decimal(10, 2)
  person     Person   @relation(fields: [personId], references: [id], onDelete: Cascade)
  function   Function @relation(fields: [functionId], references: [id], onDelete: Cascade)

  @@id([personId, functionId])
}

model ClientFunctionRate {
  id         Int      @id @default(autoincrement())
  clientId   Int
  functionId Int
  dayRate    Decimal? @db.Decimal(10, 2)
  hourRate   Decimal? @db.Decimal(10, 2)
  client     Client   @relation(fields: [clientId], references: [id], onDelete: Cascade)
  function   Function @relation(fields: [functionId], references: [id], onDelete: Cascade)

  @@unique([clientId, functionId])
}

model Material {
  id                  Int                    @id @default(autoincrement())
  name                String
  category            String?
  categoryId          Int?
  code                String?                @unique
  notes               String?
  dayPrice            Decimal                @default(0) @db.Decimal(10, 2)
  setupCost           Decimal?               @db.Decimal(10, 2)
  isBundle            Boolean                @default(false)
  bundlePriceOverride Decimal?               @db.Decimal(10, 2)
  archived            Boolean                @default(false)
  costPrice           Decimal?               @db.Decimal(10, 2)
  listPrice           Decimal?               @db.Decimal(10, 2)
  revenueBefore       Decimal?               @db.Decimal(10, 2)
  categoryRel         Category?              @relation(fields: [categoryId], references: [id])
  stockItems          StockItem[]
  projectPrices       ProjectMaterialPrice[]
  components          MaterialComponent[]    @relation("BundleParent")
  usedInBundles       MaterialComponent[]    @relation("BundleChild")
  bundleBookings      PeriodBundleBooking[]
}

model StockItem {
  id          Int               @id @default(autoincrement())
  materialId  Int
  unitNumber  Int
  identifier  String?
  notes       String?
  costPrice   Decimal?          @db.Decimal(10, 2)
  material    Material          @relation(fields: [materialId], references: [id], onDelete: Cascade)
  assignments PeriodStockItem[]

  @@unique([materialId, unitNumber])
}

model PeriodPerson {
  id               Int                @id @default(autoincrement())
  periodId         Int
  personId         Int
  functionId       Int?
  role             String?
  startAt          DateTime?
  endAt            DateTime?
  overlapAck       Boolean            @default(false)
  billingUnit      String             @default("dag")
  rateSnapshot     Decimal?           @db.Decimal(10, 2)
  dayPriceSnapshot Decimal            @db.Decimal(10, 2)
  discountPct      Decimal?           @db.Decimal(5, 2)
  discountAmount   Decimal?           @db.Decimal(10, 2)
  period           Period             @relation(fields: [periodId], references: [id], onDelete: Cascade)
  person           Person             @relation(fields: [personId], references: [id], onDelete: Cascade)
  function         Function?          @relation(fields: [functionId], references: [id])
  travelCosts      PersonTravelCost[]

  @@unique([periodId, personId])
}
```

**`prisma/schema.dev.prisma` (Float money)** — identical shapes, money as `Float`, no `@db.Decimal(...)` annotations:

```prisma
model Client {
  id            Int                  @id @default(autoincrement())
  name          String
  contactName   String?
  email         String?
  phone         String?
  address       String?
  postalCode    String?
  city          String?
  vatNumber     String?
  notes         String?
  projects      Project[]
  functionRates ClientFunctionRate[]
}

model Function {
  id          Int                  @id @default(autoincrement())
  name        String               @unique
  dayRate     Float?
  hourRate    Float?
  people      PersonFunction[]
  assignments PeriodPerson[]
  clientRates ClientFunctionRate[]
}

model PersonFunction {
  personId   Int
  functionId Int
  dayRate    Float?
  hourRate   Float?
  person     Person   @relation(fields: [personId], references: [id], onDelete: Cascade)
  function   Function @relation(fields: [functionId], references: [id], onDelete: Cascade)

  @@id([personId, functionId])
}

model ClientFunctionRate {
  id         Int      @id @default(autoincrement())
  clientId   Int
  functionId Int
  dayRate    Float?
  hourRate   Float?
  client     Client   @relation(fields: [clientId], references: [id], onDelete: Cascade)
  function   Function @relation(fields: [functionId], references: [id], onDelete: Cascade)

  @@unique([clientId, functionId])
}

model Material {
  id                  Int                    @id @default(autoincrement())
  name                String
  category            String?
  categoryId          Int?
  code                String?                @unique
  notes               String?
  dayPrice            Float                  @default(0)
  setupCost           Float?
  isBundle            Boolean                @default(false)
  bundlePriceOverride Float?
  archived            Boolean                @default(false)
  costPrice           Float?
  listPrice           Float?
  revenueBefore       Float?
  categoryRel         Category?              @relation(fields: [categoryId], references: [id])
  stockItems          StockItem[]
  projectPrices       ProjectMaterialPrice[]
  components          MaterialComponent[]    @relation("BundleParent")
  usedInBundles       MaterialComponent[]    @relation("BundleChild")
  bundleBookings      PeriodBundleBooking[]
}

model StockItem {
  id          Int               @id @default(autoincrement())
  materialId  Int
  unitNumber  Int
  identifier  String?
  notes       String?
  costPrice   Float?
  material    Material          @relation(fields: [materialId], references: [id], onDelete: Cascade)
  assignments PeriodStockItem[]

  @@unique([materialId, unitNumber])
}

model PeriodPerson {
  id               Int                @id @default(autoincrement())
  periodId         Int
  personId         Int
  functionId       Int?
  role             String?
  startAt          DateTime?
  endAt            DateTime?
  overlapAck       Boolean            @default(false)
  billingUnit      String             @default("dag")
  rateSnapshot     Float?
  dayPriceSnapshot Float
  discountPct      Float?
  discountAmount   Float?
  period           Period             @relation(fields: [periodId], references: [id], onDelete: Cascade)
  person           Person             @relation(fields: [personId], references: [id], onDelete: Cascade)
  function         Function?          @relation(fields: [functionId], references: [id])
  travelCosts      PersonTravelCost[]

  @@unique([periodId, personId])
}
```

`ClientFunctionRate`'s `onDelete: Cascade` on both relations mirrors `PersonFunction`'s own existing pattern (`schema.prisma:55-56`) — a rate-card row has no independent meaning once either side is gone. This specific choice (vs. e.g. `Restrict`) is this brief's own recommendation, not a previously-recorded PO decision — flag for sign-off alongside the rest of DDL-2. Field order within each block is for readability only; Prisma does not require new fields to be appended last.

### Concrete traps

- `src/types/index.ts` is 280 lines (`wc -l`, verified) — the project's designated exception to the 150-line rule (`CLAUDE.md`: "All domain types live in `src/types/index.ts`"). Every field above needs a matching edit across **six** interfaces (`Function`, `PersonFunction`, `Material`, `StockItem`, `PeriodPerson`, plus the new `ClientFunctionRate`) — easy to under-count in one commit.
- `prisma/seed.ts` is 563 lines (`wc -l`, verified) — already the largest file in the repo. Extracting `parseCsvLine`/`parseCsv` (`:31-79`) shrinks it; adding new seed rows grows it back. Measure after editing, not before.
- `seed.ts:331-335`'s `categoryPrefixMap` stores 2-character prefixes (`"05"`, `"02"`, …) — DDL-2 must **not** touch this. The 2→4-digit prefix rewrite is M1's job (`src/lib/material-code.ts`), landing later as its own commit; touching it here would violate the one-schema-commit-alone rule.
- `seed.ts:316-325`'s `personFunction.createMany` maps exactly one function per person (Alice→PM, Bob→Electrician, …, confirmed 1:1 for all six). "Give one person two functions at different rates" means adding one more `create` row with its own `dayRate`/`hourRate`, not restructuring the block.

### Verification commands

```bash
npx tsc --noEmit
npm run db:dev:reset
npm run db:dev:studio    # spot-check: one Function has hourRate, one Person has 2 functions, 1 ClientFunctionRate row
docker compose up -d db
docker compose run --rm app sh -c "npx prisma migrate deploy"
```
Success: `db:dev:reset` exits 0 with the seed's console summary printed; `prisma migrate deploy` reports the new migration applied with no drift; `tsc --noEmit` reports no errors touching `Function`, `PersonFunction`, `ClientFunctionRate`, `Material`, `StockItem`, or `PeriodPerson`.

### Definition of done

- [ ] Both schemas carry the exact model blocks above (or a deliberate, noted deviation)
- [ ] `src/types/index.ts` updated for all six affected interfaces
- [ ] CSV helper extracted from `seed.ts:31-79` into `src/lib/`, `seed.ts` calls it
- [ ] Seed data: one function with `hourRate`, one person with two functions at different rates, one `ClientFunctionRate` row, `costPrice`/`revenueBefore` on ≥2 materials
- [ ] `npm run db:dev:reset` and `docker compose run --rm app sh -c "npx prisma migrate deploy"` both succeed
- [ ] Existing bookings' `dayPriceSnapshot` values read back identical (no behaviour change)

---

## L1 — Rates on functions

**Branch:** `l1-function-rates` · **first in the L chain**

### Current state (verified)

- `Function` is name-only (`prisma/schema.prisma:46-50`); `PersonFunction` a bare junction (`:52-59`). Neither is read by the booking flow, `effective-price.ts`, availability, or the callsheet.
- Price resolution today: project override → `Person.dayPrice` → 0 (`src/lib/effective-price.ts:12-19`), **duplicated** inline at `src/app/api/people/available/route.ts:34-37` and client-side at `src/components/line-price-popover.tsx:42`.
- `src/app/api/people/route.ts` and `[id]/route.ts` have **no zod schema** — the only routes of their kind without one.
- `PUT /api/people/[id]` replaces the whole function set with `deleteMany: {} + create` (`[id]/route.ts:12-62`).
- No functions management page exists; functions are created only inline from the person form (`src/components/person-form.tsx:93-97`).

### Decided resolution order (Q30 + Q32b)

```
ProjectPersonPrice override
  → ClientFunctionRate (L3)
  → PersonFunction rate
  → Function default
  → Person.dayPrice
  → 0
```

### Commits

**L1.1 — `fix(people): stop wiping person functions on every save`** ← **must come before the rate columns are used**
- `PUT /api/people/[id]` currently does `deleteMany: {} + create`, which would **destroy every per-person rate row on any person save** once L1 puts rates on `PersonFunction`. Convert to a diff (add/remove only what changed).
- Add the missing zod schemas to `people/route.ts` and `people/[id]/route.ts` while you are there — same commit is acceptable since both are input validation on the same endpoints.
- Also resolve the `TODO(L1)` markers from phase 1: `functions/*` keeps its Personen module but **redacts `dayRate`/`hourRate`** for callers without `Kosten/Facturen: lezen` (via `src/lib/redact.ts`).
- **Verify:** a person save preserves rate rows; a `Kosten/Facturen: geen` caller gets functions without rates.

**L1.2 — `feat(pricing): resolve rates through one function-aware path`**
- Rewrite `src/lib/effective-price.ts` to implement the order above and return **both the amount and its source level** (`"project" | "client" | "person-function" | "function" | "person" | "none"`). With five levels, an unexplained number is a support call.
- **Update the four real callers in this same commit, or the build breaks.** `effectivePersonPrice`/`effectiveMaterialPrice` are called at `src/app/api/periods/[id]/people/route.ts:52`, `periods/[id]/people/[assignmentId]/route.ts:22`, `periods/[id]/materials/route.ts:51`, and `periods/[id]/materials/[assignmentId]/route.ts:22` — each assigns the result straight into a Decimal-typed `dayPriceSnapshot`. Returning `{ amount, source }` without touching them leaves `tsc --noEmit` failing and every person/material booking broken for several commits. Either destructure `.amount` at all four sites here, or keep a thin number-returning wrapper until L2.2.
- **There are three copies of the resolution logic, not two.** Besides the inline duplicates at `people/available/route.ts:34-37` and `line-price-popover.tsx:42`, `src/lib/pricing.ts:6-24` exports `effectiveMaterialPriceFromProject` and `effectivePersonPriceFromProject` — a client-side reimplementation. Reconcile all three onto one mechanism (server) plus, if the client genuinely needs it, one clearly-named client helper that mirrors it and is covered by the same tests.
- **Historical protection (required):** existing `dayPriceSnapshot` values were frozen under the old order. This commit must not recompute them. Add a regression test asserting a seeded historical booking's cost is byte-identical before and after.
- **Verify:** unit tests at every level, including "no rate anywhere → 0" and "project override beats everything".

**L1.3 — `feat(people): manage functions and their rates`**
- A functions management page (there is none today) plus rate fields: day and hour rate per function, and a per-person override on the person form's function chips.
- Both rate inputs optional — a function with no hour rate falls back to day billing (Q19).
- Gate on the right module + redact rates per L1.1.

**L1.4 — `test(pricing): cover the five-level resolution order`**
- Every level, every fallback, plus the source label. This test is the contract L3 extends.

**Out of scope:** using the rates at booking time (L2), hourly quantity maths (H5/L5).

### Files to read before starting

| File | Why |
|---|---|
| `src/lib/effective-price.ts` (19 lines, read in full) | The two functions L1.2 rewrites entirely — currently a 2-level fallback |
| `src/app/api/people/route.ts` (76 lines, read in full) | `POST` has no zod schema; L1.1 adds one alongside the diff fix |
| `src/app/api/people/[id]/route.ts` (75 lines, read in full) | `PUT` does the destructive `deleteMany: {} + create` L1.1 must convert to a diff |
| `src/components/person-form.tsx` (130 lines, read in full) | Inline function creation (`:93-97`); L1.3 adds day/hour rate inputs on the per-function chips here |
| `src/components/line-price-popover.tsx` (201 lines — already over the 150-line limit) | One of the three duplicated price-resolution sites (`:42`) |
| `src/app/api/people/available/route.ts` (49 lines, read in full) | A second duplicated inline resolution site (`:34-37`) |
| `src/lib/pricing.ts` (155 lines — already over the 150-line limit) | Houses a **third** copy: `effectiveMaterialPriceFromProject`/`effectivePersonPriceFromProject` (`:6-24`), a client-side reimplementation L1.2 must reconcile |
| `src/app/api/functions/route.ts` (38 lines) / `functions/[id]/route.ts` (53 lines) | Where L1.3's rate fields land; also where phase 1's `TODO(L1)` markers are meant to live — see trap below |
| `src/app/api/periods/[id]/people/route.ts`, `periods/[id]/people/[assignmentId]/route.ts`, `periods/[id]/materials/route.ts`, `periods/[id]/materials/[assignmentId]/route.ts` | The four real callers of `effectivePersonPrice`/`effectiveMaterialPrice` that must be updated in the same commit as L1.2 |

### Current behaviour — additional verified detail

`effective-price.ts` in full (19 lines) is the entire current resolution surface:
```ts
export async function effectiveMaterialPrice(projectId: number, materialId: number): Promise<number> {
  const override = await prisma.projectMaterialPrice.findUnique({
    where: { projectId_materialId: { projectId, materialId } },
  });
  if (override) return Number(override.dayPrice);
  const material = await prisma.material.findUnique({ where: { id: materialId } });
  return material ? Number(material.dayPrice) : 0;
}
```
(`effectivePersonPrice` mirrors this at `:12-19`.) Both are two levels only: project override → base `dayPrice` → `0`. Neither reads `Function`, `PersonFunction`, or `ClientFunctionRate`.

The destructive write, quoted exactly (`src/app/api/people/[id]/route.ts:43-51`):
```ts
functions:
  functionIds !== undefined
    ? {
        deleteMany: {},
        create: (functionIds as number[]).map((fid) => ({
          functionId: fid,
        })),
      }
    : undefined,
```
This deletes **every** `PersonFunction` row for the person and recreates them on every save that includes `functionIds` — harmless today (the join carries no other data), but once L1 adds `dayRate`/`hourRate` to `PersonFunction` this wipes every person-level rate override on any unrelated field edit.

The three duplicated resolution sites, quoted:
1. `line-price-popover.tsx:42` — `const effective = override ?? basePrice;` (client-side display only, no fallback below `basePrice`).
2. `people/available/route.ts:34-37`:
   ```ts
   const basePrice = Number(p.dayPrice);
   const effectivePrice = overrideMap.get(p.id) ?? basePrice;
   ```
3. `pricing.ts:6-24` — `effectiveMaterialPriceFromProject`/`effectivePersonPriceFromProject`, operating on an already-loaded `Project` object.

No zod schema exists on either people route — both destructure `req.json()` directly with a single manual `if (!name) return badRequest(...)` check, unlike every other entity route in this codebase (e.g. `functions/route.ts:11,31` uses `z.object({...}).safeParse`).

Inline function creation, quoted (`person-form.tsx:93-97`):
```tsx
<EntityCombobox
  items={functions.filter((f) => !selectedFnIds.includes(f.id))}
  value={null} onChange={(id) => id && toggleFn(id)}
  onCreate={createFunction} placeholder="Functie toevoegen..." createLabel="+ Nieuwe functie"
/>
```

### Five-level resolution order — pseudocode (Q30 + Q32b)

```
function resolvePersonRate(projectId, personId, functionId, unit: "dag"|"uur"):
  # 1. project override — existing mechanism, unchanged in shape
  override = ProjectPersonPrice.find({ projectId, personId })
  if override exists: return { amount: override.dayPrice, source: "project" }

  # 2. client rate card (slot exists from L1.2 onward; populated by L3)
  clientId = Project.find(projectId).clientId
  if clientId and functionId:
    cfr = ClientFunctionRate.find({ clientId, functionId })
    rate = unit == "uur" ? cfr?.hourRate : cfr?.dayRate
    if rate != null: return { amount: rate, source: "client" }

  # 3. person-function override
  if functionId:
    pf = PersonFunction.find({ personId, functionId })
    rate = unit == "uur" ? pf?.hourRate : pf?.dayRate
    if rate != null: return { amount: rate, source: "person-function" }

  # 4. function default
  if functionId:
    fn = Function.find(functionId)
    rate = unit == "uur" ? fn?.hourRate : fn?.dayRate
    if rate != null: return { amount: rate, source: "function" }

  # 5. person's own base day price (no hourly equivalent exists on Person)
  person = Person.find(personId)
  if person.dayPrice > 0: return { amount: person.dayPrice, source: "person" }

  # 6. nothing resolves
  return { amount: 0, source: "none" }
```
`Person.dayPrice` has no hourly counterpart, so an `"uur"` request that falls to level 5 must still return a **day** figure (Q19's fallback) — make the resolver's return shape say so explicitly (e.g. echo back the unit actually used) so H5.1's caller can tell it did not get an hourly number.

### Concrete traps

- **`src/lib/pricing.ts` is already 155 lines** (`wc -l`, verified) — over the 150-line limit *before* H5.1 touches it. L1.2 should only reconcile the client-side wrapper here, not add bulk; put any genuinely new client helper in a new file.
- **`src/lib/redact.ts` does not exist in the current tree** (verified: no file at that path, no `redact` identifier anywhere under `src/`, and zero hits for `requireModule` project-wide). L1.1's redaction sub-step is a hard dependency on phase 1 having actually merged — if it hasn't, say so rather than inventing a redaction mechanism ad hoc.
- **The `TODO(L1)` markers do not exist yet either** — `functions/route.ts` (38 lines) and `functions/[id]/route.ts` (53 lines) were read in full; neither contains a `TODO` comment today. Expected, since phase 1 hasn't shipped in this tree — verify the marker exists post-phase-1-merge before treating this bullet as blocking.
- **Four call sites, not fewer**, all confirmed by direct read: `periods/[id]/people/route.ts:52` (`dayPriceSnapshot: await effectivePersonPrice(...)`), `periods/[id]/people/[assignmentId]/route.ts:22`, `periods/[id]/materials/route.ts:51`, `periods/[id]/materials/[assignmentId]/route.ts:22`. Each assigns the return value directly into a `Decimal`-typed Prisma field — changing the return type to `{amount, source}` without updating all four breaks `tsc --noEmit` on all four simultaneously.
- `src/components/person-form.tsx` is 130 lines — room remains under 150 for L1.3's rate chips, but only barely; consider a sub-component from the start.

### Verification commands

```bash
npx tsc --noEmit
npm run lint
npm test
```
Success: `tsc`/`lint` clean; the new effective-price test suite covers all five levels plus `"no rate anywhere → 0"` and `"project override beats everything"`; a historical-snapshot regression test asserts a seeded pre-L1 `dayPriceSnapshot` is byte-identical after L1.2.

### Definition of done

- [ ] L1.1: `PUT /api/people/[id]` diffs functions (add/remove only); zod schemas added to both people routes; functions redacted per role (explicitly deferred if `redact.ts` doesn't exist yet)
- [ ] L1.2: `effective-price.ts` returns `{amount, source}` for all 5 levels; all 4 real callers updated in the same commit; the 3 duplicate sites reconciled; historical-snapshot regression test passes
- [ ] L1.3: functions management page ships; day/hour rate optional on both `Function` and `PersonFunction`; gated + redacted
- [ ] L1.4: five-level resolution test suite exists and passes, asserting the source label at every level

---

## L2 — Pick the function at booking time

**Branch:** `l2-booking-function` · **after L1**

### Current state

Booking silently copies `p.person.role` into the assignment: `src/components/person-split-editor.tsx:151` sends `role: p.person.role ?? undefined`. There is **no function picker anywhere**. The printed callsheet's column headed "Functie" renders that legacy free-text field (`src/app/(app)/projects/[id]/callsheet/page.tsx:109`). `PATCH /api/periods/[id]/people/[assignmentId]` accepts a `role` string (`:26`) that no UI ever sends.

**L2.1 — `feat(bookings): record the chosen function on an assignment`**
- Write `PeriodPerson.functionId` on create; keep `role` as a display fallback for now (L4 retires it in phase 4).
- **Backfill** existing assignments by exact name match against `Function.name` — clean in seed data (1:1, `seed.ts:316-325`), but real data may not match. **Log every unmatched row rather than guessing**, and report the count.

**L2.2 — `feat(bookings): choose a function when booking a person`**
- Picker in the booking flow: default to the person's only function; when they have several, require a choice. Show the resolved rate **and its source** (from L1.2) before confirming.
- Snapshot behaviour must match the existing convention (`src/app/api/periods/[id]/people/route.ts:52` sets `dayPriceSnapshot` from `effectivePersonPrice`).
- `person-split-editor.tsx` was split in phase 0 (Y3.3) — extend the extracted component, do not re-inflate the parent.

**L2.3 — `feat(documents): print the chosen function on the callsheet`**
- `callsheet/page.tsx:109` reads from the relation instead of the legacy string, falling back to `role` only where `functionId` is null (pre-backfill rows).

### Files to read before starting

| File | Why |
|---|---|
| `src/components/person-split-editor.tsx` (230 lines — already over the 150-line limit, read in full) | Line 151 sends the legacy `role` string; L2.2 adds the function/rate picker here |
| `src/app/(app)/projects/[id]/callsheet/page.tsx` (124 lines, read in full) | Line 109 prints the legacy `role` field; L2.3's target |
| `src/app/api/periods/[id]/people/[assignmentId]/route.ts` (49 lines, read in full) | `PATCH` already accepts a `role` string (`:14,26`) that no UI sends — L2.1 adds `functionId` here |
| `src/app/api/periods/[id]/people/route.ts` (62 lines, read in full) | `POST` where L2.1 writes `functionId` on create, alongside the existing `role` write (`:51`) |
| `prisma/seed.ts:307-325` | The 1:1 person→function seed mapping L2.1's backfill can rely on being clean in dev, but not in the PO's real data |

### Current behaviour — additional verified detail

`person-split-editor.tsx:151`, quoted exactly:
```tsx
onClick={() => add.mutate({ personId: p.person.id, role: p.person.role ?? undefined })}
```
This is the only place a booking is created client-side; there is no function picker anywhere in this file (230 lines, read in full) or in the booking flow generally.

`callsheet/page.tsx:109`, quoted exactly:
```tsx
<td className="p-2">
  {pp.role ?? pp.person.role ?? "—"}
</td>
```

`periods/[id]/people/[assignmentId]/route.ts:14,26`, quoted:
```ts
const { resnapshotPrice, discountPct, discountAmount, role } = await req.json();
...
if (role !== undefined) data.role = role;
```
Confirmed: `role` is accepted and persisted on `PATCH`, but no UI component in the codebase (grepped `person-split-editor.tsx`, `period-bookings.tsx`) ever sends a `role` field to this endpoint — dead-but-wired capacity, exactly as the existing brief text states.

### Concrete traps

- **`person-split-editor.tsx` is already 230 lines** (`wc -l`, verified) — over the 150-line limit before L2.2 touches it. "Extend the extracted component, do not re-inflate the parent" means the function/rate picker must go in a **new** file the parent imports.
- **Backfill ambiguity**: the six seeded people (`seed.ts:307-325`) each have a `Person.role` that is an exact `Function.name` match ("Project Manager", "Electrician", …), so dev testing will show 100% match and hide any bug in the unmatched-row logging path. Test that path explicitly with a deliberately mismatched fixture (e.g. `role: "Sparky"` with no matching `Function`), not only against seed data.
- **`PeriodPerson.role` stays** after L2.1 lands — it is not dropped until phase 4's L4.2. Both `role` and `functionId` are readable on the same row during phases 2–3; L2.3's fallback rule (`functionId` first, `role` only when null) is the only place that decides which one wins for display.

### Verification commands

```bash
npx tsc --noEmit
npm run lint
npm test
```
Success: after L2.1, every `PeriodPerson` row with `functionId IS NULL` and `role IS NOT NULL` appears in the backfill's logged "unmatched" report; the count matches what is reported in the phase-2 exit report.

### Definition of done

- [ ] L2.1: `functionId` written on create; backfill run with logged unmatched-row count and list
- [ ] L2.2: picker defaults to a person's sole function, forces a choice when they have several; shows resolved rate + source before confirm; new sub-component, parent unchanged in line count
- [ ] L2.3: callsheet reads `functionId` first, falls back to `role` only when `functionId` is null

---

## L3 — Client rate cards

**Branch:** `l3-client-rates` · **after L2**

`Client` links only to `Project` (`prisma/schema.prisma:32`); nothing client→function exists today. Q32 chose a rate card that **both filters the picker and prices it**.

**L3.1 — `feat(clients): manage per-client function rates`**
- CRUD on `ClientFunctionRate` from the client detail page: add function, set day/hour rate, remove.
- API: `GET/POST /api/clients/[id]/rates`, `PUT/DELETE /api/clients/[id]/rates/[functionId]` — module **Kosten/Facturen** (these are commercial terms), and add them to N2.5's guard coverage.

**L3.2 — `feat(bookings): scope the function picker to the client's rate card`**
- On a project for a client with rate-card rows, the picker offers **only** those functions.
- **Critical fallback:** a client with **no** rate-card rows must show **all** functions, not none — otherwise creating a new client breaks booking entirely. Test this explicitly.

**L3.3 — `feat(pricing): apply client rates above the person override`**
- Slot `ClientFunctionRate` into `effective-price.ts` between the project override and the person-function rate (Q32b: the client card wins). Extend L1.4's tests to all five levels with the client level populated.
- **Verify:** booking a person on a prg project charges prg's agreed rate even when that person has their own higher rate; the source label reads `"client"`.

### Files to read before starting

| File | Why |
|---|---|
| `prisma/schema.prisma:21-33` (`Client`) | Confirms no function-rate relation exists today; L3.1 adds the `functionRates` CRUD around DDL-2's new inverse field |
| `src/lib/effective-price.ts` (post-L1.2) | L3.3 slots `ClientFunctionRate` into the same function, between levels 1 and 3 |
| `.plans/2026-08-po-feedback-round2.md:46-47` (Q32/Q32b) | The exact precedence text L3.3 must satisfy |

Note: an existing `src/app/api/clients/[id]/route.ts`-style nested-route convention to mirror for `/rates` was not independently confirmed in this pass — check what exists under `src/app/api/clients/` before assuming a local pattern; if L3.1 is the first nested client route, follow the project's general `requireAuth()` + response-helper convention only.

### Concrete traps

- **The "no rate-card rows → show all functions" fallback (L3.2) is the path most likely to go silently untested** — it is the *default* state for every existing client (seed and production) until the PO fills in rate cards, so a regression here breaks booking for every client on day one. Write this test before the "has rate card rows" happy path.
- L3.3 extends L1.4's test suite rather than replacing it — confirm L1.4 already exists and is green before adding client-level cases, per the phase's own dependency order.

### Verification commands

```bash
npx tsc --noEmit && npm run lint && npm test
```
Success: a project for a client with rate-card rows offers only those functions in the picker; a project for a client with zero rate-card rows offers every function; the source label reads `"client"` when a client rate wins over a higher person-function rate, verified with a fixture where the person's own rate is deliberately higher.

### Definition of done

- [ ] L3.1: CRUD routes exist, gated on `Kosten/Facturen`, added to N2.5's guard enumeration
- [ ] L3.2: picker scoping implemented with the empty-rate-card fallback explicitly tested
- [ ] L3.3: `effective-price.ts` updated, L1.4's suite extended (not replaced) to cover the client level

---

## H1 — Assignment-level time windows `critical booking logic`

**Branch:** `h1-assignment-hours` · **owns `src/lib/availability.ts`**

### Current state

- Overlap detection is already strict: `AND: [{ startDate: { lt: args.to } }, { endDate: { gt: args.from } }]` (`src/lib/availability.ts:92`; same shape at `:28,65,125`). Back-to-back periods do not conflict — round-1 Q16, tested at `src/lib/availability.test.ts:29-64`.
- A person is booked **per period**, so a Mon–Fri period books them solid.
- `POST /api/periods/[id]/people` does check-then-create with **no transaction and no `P2002` catch** (`src/app/api/periods/[id]/people/route.ts:24-47`), unlike the material path which uses `$transaction` + pg advisory locks (`src/lib/booking.ts:34,61,120`). A lost race surfaces as a raw 500.

**H1.1 — `feat(bookings): compare availability against the assignment window`**
- Add `effectiveWindow(assignment)` returning the assignment's `startAt`/`endAt` when set, else the period's. Make `checkPersonAvailability` (`availability.ts:85-96`) compare against it.
- Keep the strict `lt`/`gt` boundary — it is already correct and tested. Do not touch the stock/bundle paths.
- Validate server-side: the window must fall inside its period and `endAt > startAt`.
- **Update `src/lib/availability.test.ts` in this commit, not in H1.4.** The existing tests mock `periodPerson.findFirst` against the current period-level `AND` filter shape (`availability.test.ts:29-76`). Changing the query shape here while deferring the test rewrite to H1.4 leaves `npm test` red for three commits, violating the green-at-every-commit rule. H1.4 then *adds* the new window cases on top.

**H1.2 — `fix(bookings): book a person inside a transaction`**
- Wrap check-then-create in an interactive `$transaction` with the availability re-check **inside**, mirroring `src/lib/booking.ts:61,120`. Catch `P2002` → `conflict()` as the material route does (`src/app/api/periods/[id]/materials/route.ts:46,65`).
- This is a pre-existing race, fixed here because H1 makes the window finer and the race likelier.

**H1.3 — `feat(bookings): set custom hours on an assignment`**
- **Fix the silent dead end while you are here.** `src/components/person-split-editor.tsx:36-39,44` hides anyone already in `period.people` from the available list with no explanation. Since the unique constraint stays (one window per person per period), a user trying to give an already-booked person a second window in the same period hits a wall with no message — and the API's informative `conflict("… staat al toegewezen aan deze periode")` (`src/app/api/periods/[id]/people/route.ts:26-28`) is never reached because the client filters the request away. Show the person as a **disabled row with an explanation** ("al toegewezen — pas de uren aan op de bestaande boeking") instead of removing them silently.
- Optional "eigen uren" on the assignment row (extend the phase-0 split components). Show the window in `src/components/period-bookings.tsx:52` and on the callsheet.
- **Apply the Time rule:** these are the first datetime fields written from a per-assignment form. Send full ISO strings with offset; never `.slice(0, 10)`; never bare `yyyy-MM-ddTHH:mm`. **Verify against Postgres, not SQLite**: a Brussels 18:00–23:00 window must round-trip identically on a UTC server and must not shift when read back into a `datetime-local` input. Record the round-trip evidence in the commit body.

**H1.4 — `test(availability): cover assignment windows`**
- Same-day non-overlapping windows allowed; 1-minute overlap blocked; touching boundaries allowed; a window narrower than the period frees the rest of the day; **null window behaves exactly as today** (regression); the transaction re-check rejects a racing double-insert.

### Files to read before starting

| File | Why |
|---|---|
| `src/lib/availability.ts` (136 lines, read in full) | H1 owns this file entirely; `checkPersonAvailability` (`:78-105`) is what H1.1 rewires |
| `src/lib/pricing.ts` (155 lines) | Context only for H1 — H5/L5 owns writes to it, but H1.3's custom-hours UI must eventually feed `personLineCost` via H5 |
| `src/lib/booking.ts` (163 lines, read in full) | The transaction + advisory-lock pattern H1.2 must mirror for people bookings |
| `src/app/api/periods/[id]/people/route.ts` (62 lines, read in full) | The check-then-create sequence with no transaction, H1.2's direct target |
| `src/lib/availability.test.ts` (77 lines, read in full) | Every existing case must keep passing; H1.1 rewrites the mocked query shape in the same commit |
| `src/components/person-split-editor.tsx:36-39,44` | The silent-hide bug H1.3 must fix alongside adding custom hours |

### Current behaviour — additional verified detail

The overlap query, identical shape at all four call sites (`availability.ts:28`, `:65`, `:92`, `:125` — confirmed by reading the whole 136-line file):
```ts
period: {
  AND: [{ startDate: { lt: args.to } }, { endDate: { gt: args.from } }],
},
```
`checkPersonAvailability` in full (`availability.ts:78-105`):
```ts
export async function checkPersonAvailability(
  personId: number,
  args: RangeArgs & { sameProjectId?: number },
): Promise<{
  blockingProject?: { id: number; name: string };
  sameProjectWarning?: { projectId: number; projectName: string };
}> {
  const conflict = await defaultPrisma.periodPerson.findFirst({
    where: {
      personId,
      ...(args.excludePeriodId != null ? { NOT: { periodId: args.excludePeriodId } } : {}),
      period: {
        AND: [{ startDate: { lt: args.to } }, { endDate: { gt: args.from } }],
      },
    },
    include: { period: { include: { project: true } } },
  });
```
This compares only against the **period's** `startDate`/`endDate` — nothing in this function references a per-assignment window, confirming a person is booked "per period" today.

The check-then-create sequence in `periods/[id]/people/route.ts` (full file, 62 lines):
```ts
const existing = await prisma.periodPerson.findUnique({
  where: { periodId_personId: { periodId, personId: parseInt(personId) } },
});
if (existing) { return conflict(`${person.name} staat al toegewezen aan deze periode`); }

const check = await checkPersonAvailability(parseInt(personId), { ... });
if (check.blockingProject) { return conflict(...); }
...
const assignment = await prisma.periodPerson.create({ ... });
```
No `$transaction`, no `P2002` catch — confirmed: the whole handler has exactly one `try/catch`, falling through to a generic `serverError()`, not `conflict()`.

The transaction + advisory-lock pattern H1.2 must mirror, quoted from `booking.ts:30-39` and `:59-92`:
```ts
export async function lockMaterials(tx: PrismaClient, materialIds: number[]): Promise<void> {
  if ((process.env.DATABASE_URL ?? "").startsWith("file:")) return;
  const sorted = [...new Set(materialIds)].sort((a, b) => a - b);
  for (const id of sorted) {
    await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(1234567, ${id})`);
  }
}
```
```ts
const result = await client.$transaction(async (tx) => {
  await lockMaterials(tx as unknown as PrismaClient, [args.materialId]);
  const free = await freeStockItemIds(tx as unknown as PrismaClient, args.materialId, args.from, args.to);
  if (free.length < args.quantity) { throw err; }
  ...
});
```
Notable: `lockMaterials` **no-ops on SQLite** (`if ((process.env.DATABASE_URL ?? "").startsWith("file:")) return;`) — the advisory-lock re-check is a Postgres-only guarantee, so the race condition itself cannot be exercised against the SQLite dev DB. H1.2 should mirror this exact guard (e.g. a `lockPeople`-style helper with its own advisory-lock key namespace, so it never collides with the materials lock).

### Existing tests in `availability.test.ts` — full list, by name

1. `"back-to-back periods should NOT conflict (end 12:00 / start 12:00)"` (describe `"availability — strict boundary (B7 Q16)"`) — exercises `findAvailableStockItems`, a stock-item path H1 does not touch; must keep passing unmodified.
2. `"1-minute overlap should conflict"` (same describe) — same reasoning, untouched by H1.
3. `"returns no conflict when back-to-back"` (describe `"checkPersonAvailability — strict boundary"`) — **this is the one H1.1 must update in the same commit**: it mocks `periodPerson.findFirst` against the period-level `AND` filter shape; once `checkPersonAvailability` compares against `effectiveWindow()` instead, the mock's shape must change or the test either fails or passes without exercising the new logic at all.

### Existing tests in `pricing.test.ts` — full list, by name

`periodDays` (3 cases: same-day, 2-day span, 3-day date-string span) · `lineCost` (4: no discount, percentage discount, flat discount, never below 0) · `materialLineCost` (3: quantity×snapshot×days, setup added once not multiplied, setup on top of a discounted rental) · `personLineCost` (1: snapshot × days) · `periodTotal` (3: empty period, sums materials+people, bundle booking counted separately) · `B6 cost split` (4 cases) · `travel costs` (2 cases) — **18 cases total**, none referencing `billingUnit`/`rateSnapshot`/an hourly path (grepped, zero hits). All 18 are the day-rate regression baseline H5.3 protects. **None require updating for H1 alone** — H1 changes availability windows only, not cost math; H5.1/H5.3 are the commits that touch this file.

### Concrete traps

- **`src/lib/availability.ts` is 136 lines** (`wc -l`, verified) — 14 lines of headroom before the 150-line limit. Adding `effectiveWindow()` plus its validation is likely to push this over; extract into a new file if so.
- **`src/lib/booking.ts` is already 163 lines** (`wc -l`, verified) — already over the 150-line limit today. H1.2 only reads this file for the pattern to mirror; it does not edit `booking.ts` itself. If a shared helper is needed, put it in `availability.ts` or a new file.
- **`src/components/person-split-editor.tsx` is 230 lines** (`wc -l`, verified) — already over the limit before H1.3's "disabled row with explanation" change and the custom-hours UI; both should land as new sub-components.
- The brief's own instruction to update `availability.test.ts` "in this commit, not H1.4" is corroborated: test 3 mocks `periodPerson.findFirst` directly and needs its mock reshaped for `effectiveWindow`, so deferring it leaves `npm test` red across H1.1's commit.

### Verification commands

```bash
npx tsc --noEmit && npm run lint
npm test -- src/lib/availability.test.ts
npm test
```
Success: all pre-existing cases in `availability.test.ts` still pass (3/3 today, more after H1.4); no new failures in `pricing.test.ts` (18/18 stay green, since H1 doesn't touch pricing).

### Definition of done

- [ ] H1.1: `effectiveWindow()` added; `checkPersonAvailability` compares against it; server-side validation of window-inside-period and `endAt > startAt`; `availability.test.ts` updated in this same commit
- [ ] H1.2: `POST /api/periods/[id]/people` wrapped in `$transaction` with the availability re-check inside; `P2002` caught → `conflict()`; advisory-lock helper mirrors `booking.ts:30-39`
- [ ] H1.3: disabled-row explanation replaces silent hiding (`person-split-editor.tsx:36-39,44`); custom hours UI added as a new sub-component; Postgres round-trip evidence recorded in the commit body (or explicitly stated as not run)
- [ ] H1.4: same-day non-overlap, 1-minute overlap, touching boundaries, narrower-than-period, null-window regression, and racing-double-insert transaction test all present and passing

---

## H2 — Explicit double-booking override

**Branch:** `h2-overlap-override` · **after H1**

**H2.1 — `feat(bookings): allow a confirmed double booking`**
- `POST /api/periods/[id]/people` accepts `allowOverlap: true`; without it an overlap is still refused. Persist `overlapAck = true`. **The API must refuse without the flag** — never let the client be the only gate.
- Confirm dialog naming the conflicting project and window.

**H2.2 — `feat(bookings): flag forced double bookings everywhere`**
- Badge on the assignment row, in `period-bookings.tsx`, and on the callsheet. Planning surfaces it in phase 3 (I3).
- **Verify:** an overlapping booking is refused by default, accepted after confirmation, and visibly marked wherever that person appears.

### Files to read before starting

| File | Why |
|---|---|
| `src/app/api/periods/[id]/people/route.ts` (post-H1.2) | Where `allowOverlap`/`overlapAck` is accepted and persisted |
| `src/components/period-bookings.tsx` (148 lines, read in full) | Where the forced-double-booking badge is shown, alongside the existing role display (`:52`) |
| `src/app/(app)/projects/[id]/callsheet/page.tsx` (124 lines) | Where the badge must also surface, per H2.2 |

### Concrete traps

- **`period-bookings.tsx` is 148 lines** (`wc -l`, verified) — only 2 lines of headroom before the 150-line limit. Adding a badge is small but this file is right at the edge; watch it.
- H2.1's "API must refuse without the flag" needs a test that the flag is read from the **server-validated** request body, not trusted from a client-side toggle with no matching guard — reuse the existing `conflict()` helper (`src/lib/api-auth.ts`), not a bespoke error shape.

### Verification commands

```bash
npx tsc --noEmit && npm run lint && npm test
```
Success: an overlapping booking without `allowOverlap: true` still returns `conflict()`; with the flag, it succeeds and `overlapAck = true` is persisted; the badge renders in `period-bookings.tsx` and the callsheet for that assignment.

### Definition of done

- [ ] H2.1: `allowOverlap` accepted, refusal remains the default, `overlapAck` persisted, confirm dialog names the conflicting project/window
- [ ] H2.2: badge visible in `period-bookings.tsx` and on the callsheet

---

## H5/L5 — Hourly billing

**Branch:** `h5-hourly-billing` · **after H1 + L1** · **owns `src/lib/pricing.ts`**

Today any window bills a full day: `periodDays` is `differenceInCalendarDays + 1` floored at 1 (`src/lib/pricing.ts:26-35`) and `personLineCost` is `snapshot × days` (`:58-60`). Time of day is never read.

**H5.1 — `feat(pricing): bill person lines per hour or per day`**
- Read `billingUnit` + `rateSnapshot` from the assignment. For `uur`, derive hours from the effective window (H1); for `dag`, keep today's calendar-day maths exactly.
- **Keep the signature `personLineCost(line, days)`** — `line` is the assignment, so it already carries the unit, the rate and the window after DDL-2. The three call sites (`src/components/person-split-editor.tsx:209`, `period-bookings.tsx:66`, `project-costs-tab.tsx:139`) then need no change, which is what makes the byte-identical guarantee achievable.
- **Precedence for the rate:** `rateSnapshot ?? dayPriceSnapshot`. Every existing row has `rateSnapshot = null`, so historical lines keep using `dayPriceSnapshot` and produce identical figures. Never backfill `rateSnapshot`.
- **Fallback (Q19):** if the resolved function has no hour rate, bill a full day — and make the UI say so rather than silently charging a day for three hours.
- Round consistently with the existing helpers (cents at each step — do not "improve" the rounding strategy here).

**H5.2 — `feat(bookings): choose the billing unit when booking`**
- Unit selector next to the function picker (L2.2); snapshot the unit and the resolved rate.

**H5.3 — `test(pricing): cover hourly billing and day-rate regressions`**
- A 4-hour evening assignment at an hourly rate bills 4 × hour rate; a function without an hour rate still bills a day; **every existing day-billed figure is byte-identical** (this is the regression that protects historical projects).

### Files to read before starting

| File | Why |
|---|---|
| `src/lib/pricing.ts` (155 lines — already over the 150-line limit, read in full) | H5 owns this file; `periodDays` (`:26-35`) and `personLineCost` (`:58-60`) are the exact functions H5.1 changes |
| `src/lib/pricing.test.ts` (282 lines, read in full) | 18 existing cases, all day-rate-only — the byte-identical regression baseline |
| `src/components/person-split-editor.tsx:209`, `period-bookings.tsx:66`, `project-costs-tab.tsx:139` | The three call sites of `personLineCost` that must need **no signature change** |
| H1's `effectiveWindow()` (post-H1.1) | H5.1's hourly path derives hours from this |

### Current behaviour — additional verified detail

`periodDays` (`pricing.ts:26-35`):
```ts
export function periodDays(period: Pick<Period, "startDate" | "endDate">): number {
  const days = differenceInCalendarDays(new Date(period.endDate), new Date(period.startDate)) + 1;
  return Math.max(1, days);
}
```
`personLineCost` (`pricing.ts:58-60`):
```ts
export function personLineCost(line: PeriodPerson, days: number): number {
  return lineCost(line.dayPriceSnapshot, days, line);
}
```
Neither reads a time-of-day value anywhere — `days` is a whole calendar-day count derived purely from `Period.startDate`/`endDate`, confirming "time of day is never read."

Three call sites, confirmed by direct read:
- `person-split-editor.tsx:209` — `{formatEUR(personLineCost(pp, days))}`
- `period-bookings.tsx:66` — `{formatEUR(personLineCost(pp, days))}`
- `project-costs-tab.tsx:139` — `cost={personLineCost(pp, days)}` (passed into `<PersonCostRow>`)

All three pass `(pp, days)` where `pp` is the `PeriodPerson` row itself — H5.1 can add `billingUnit`/`rateSnapshot` reads **inside** `personLineCost` without touching any of these three call sites, provided the function keeps reading its first argument as "the whole assignment."

### Existing day-rate regression baseline (exact figures from `pricing.test.ts`)

- `personLineCost` "snapshot × days": `personLineCost(makePerson(200), 3) === 600`.
- `periodTotal` "sums materials and people": 2-day period, `makeStockItem(100)` + `makePerson(200)` → `600`.
- `B6 cost split` "only-people period": `periodPeopleCost === 100` for a 1-day `makePerson(100)`.
- `travel costs` "periodTotal and projectCostSummary include travel as its own bucket": 2-day period, person snapshot 100 + travel 150 → `periodTotal === 350`.

H5.3's regression test should assert these same figures unchanged post-H5.1, using the same fixtures. `makePerson` (`pricing.test.ts:55-91`) currently returns a `PeriodPerson` object with no `billingUnit`/`rateSnapshot`/`functionId`/`startAt`/`endAt` — once the type requires these, this factory needs sane defaults (`billingUnit: "dag"`, `rateSnapshot: null`) added in the **same commit** as the type change, or all 18 existing cases fail to typecheck, not merely to assert correctly.

### Concrete traps

- **`src/lib/pricing.ts` is already 155 lines** — over budget before H5.1 adds anything. Extract the hourly-branch logic (reading `billingUnit`, deriving hours from `effectiveWindow()`, falling back to day billing) into a new file that `personLineCost` calls, rather than inlining it here.
- **`makePerson` in `pricing.test.ts:55-91` must gain new fields in the same commit as the `PeriodPerson` type change** — otherwise every one of the 18 existing cases fails to compile, not just to assert.
- **Precedence must be evaluated per-line, not per-period**: a period mixing a legacy day-billed assignment (`rateSnapshot: null`) and a new hourly one (`rateSnapshot: 45`) must bill each correctly. No existing test covers a *mixed* period — H5.3 should add one.

### Verification commands

```bash
npx tsc --noEmit && npm run lint
npm test -- src/lib/pricing.test.ts
npm test
```
Success: all 18 pre-existing `pricing.test.ts` cases pass unchanged (byte-identical figures); new hourly cases pass; `src/lib/pricing.ts` (or its extraction) stays ≤150 lines.

### Definition of done

- [ ] H5.1: `personLineCost` reads `billingUnit`/`rateSnapshot`, precedence `rateSnapshot ?? dayPriceSnapshot`, day fallback when no hour rate, rounding unchanged, signature unchanged, three call sites untouched
- [ ] H5.2: unit selector next to the function picker; unit + resolved rate snapshotted at booking time
- [ ] H5.3: 4-hour hourly case, no-hour-rate-falls-back-to-day case, every pre-existing day-billed figure byte-identical, and a mixed-period case

---

## M1 — Material import

**Branch:** `m1-material-import` · independent · ✅ **`.plans/data-import-export-design.md` is written — read it in full; it is authoritative over this summary** (it defines the shared parse→preview→apply pipeline that P3 reuses in phase 4; M1 may proceed without it if the design doc slips, but then P3 must adopt M1's shape rather than the reverse)

### The files (verified 2026-08-14)

Converted CSVs and a working stdlib converter live in `.plans/tools/`. Both exports share an identical 82-column layout; the content does not.

| | "normal" (`Export_Equipment_20260814.xlsx`) | "advanced" (`… (1).xlsx`) |
|---|---|---|
| Rows / unique IDs / unique codes | 113 / 104 / 103 | 287 / 287 / 287 |
| Type | 109 Physical item, 1 Physical combination, 3 Virtual combination | **287 Physical combination** |
| Archived | 0 for all | **1 for all** |
| Price | 4 zero, max €15 000 | **0 for all** |
| Stock method | 16 Serialized, 97 Bulk | 287 Bulk |
| Codes | 111 × `NNNN-NNN`, 2 plain digits, **5 duplicates** incl. `9998-902` | 287 plain digits, no duplicates |
| Folder | 11 values (`0501-Tenten`, …) | empty |

The normal file's 103 codes are a **100% match** with `prisma/seed-data/materials.csv` — it is the same master, re-exported in English. Rows are a flattened **equipment × serial-number join**, so equipment repeats; dedupe on the export's `ID` column.

### Column mapping

| Source | Target | Notes |
|---|---|---|
| `ID` | dedupe key | **Dedupe by `ID` first.** Rows repeat per serial number: 113 rows, 104 unique IDs |
| `Code` | `Material.code` (`@unique`) | **Only ONE genuine collision after ID-dedup**: `9998-902` is claimed by ID 707 "Vorken (vis)" and ID 708 "Messen (Vis)". The other four apparent duplicates (`0501-003`, `0201-010`, `0501-001`, `0501-002`) are the *same* item across its serial rows and must NOT be renumbered. Per Q58: lowest ID keeps the code, the other gets the next free code, both in the report; the import never fails |
| `Name (in database)` | `Material.name` | |
| `Folder (Folder)` `0501-Tenten` | `Category.prefix` `0501` (**all four digits**) + `Category.name` `Tenten` | 11 categories, auto-created (Q36b). ⚠️ **Fix `nextCode()` first** — `src/lib/material-code.ts:2` matches `^{prefix}01-(\d{3})$`, i.e. a 2-digit prefix plus a hard-coded `"01"`. The real folders need all four digits (`9997`/`9998`/`9999` truncate to `"99"` and collide). Change to `^{prefix}-(\d{3})$`; that reproduces `0501-003` and `9998-902` exactly. Do it as its own commit **before** M1.4 writes anything |
| `Rental-/Sales price` | `Material.dayPrice` | 4 zero-priced rows |
| `Type of equipment` | `Material.isBundle` | **Only `Virtual combination` → true** (3 rows). `Physical combination` is an ordinary asset that can hold content — `Schepijs vriezer` (qty 1, €55) and **every one of the advanced file's 287 rows**; mapping those to bundles would create 288 empty unbookable recipes. The export has **no component data**, so the 3 real sets import as empty shells whose contents are entered by hand. Say so in the import report |
| `Stock calculation method` + `Current quantity` | `StockItem` rows | Serialized → one per serial row, `identifier` from `Manufacturer serial number (Serial number)`; Bulk → generate `Current quantity` units |
| `Internal remark` | `Material.notes` | 2 rows |
| `Archived` | `Material.archived` | the advanced file is 100% archived (Q34b) |
| purchase price, `List price` | `Material.costPrice`, `Material.listPrice` | Q36c — also the input for K4 payback |
| `ID` | import bookkeeping | the stable external key for deduping the serial join |
| everything else | **not imported** | declined (Q36c): dimensions, weight, volume, power, current, margin price, critical stock, ledger accounts, factor/discount groups, webshop fields, purchase date, book value |

### Commits

**M1.1 — `feat(import): parse equipment exports`**
- A parser producing normalised rows from `.xlsx` **and** `.csv`. Prefer no heavy dependency — the xlsx format is a zip of XML and a ~40-line stdlib reader handled both files during recon (`.plans/tools/xlsx-to-csv.py` is the proof); if you add a library, justify it in the commit body.
- Reuse the header-detection and dedup logic extracted from `seed.ts` by DDL-2.
- **Build it as the round-trip pipeline from the start (Q56).** Everything RentFlow exports must be importable in the same format, so the adapter interface lands here rather than being retrofitted in phase 4's P3. The material adapter accepts **two** input shapes: RentFlow's own export format and the 82-column Rentman layout (Q57).
- Pure function + unit tests against **both real files** in `.plans/tools/`. No DB writes in this commit.

**M1.2 — `feat(import): compute an import preview`**
- `POST /api/materials/import/preview` (module **Materialen: wijzigen**) returning per-row classification: `new` / `updated` / `unchanged` / `skipped` / `error`, each with the source line number and a reason, plus totals.
- Match on `code`, update existing (Q36a). Never write in this endpoint.

**M1.3 — `feat(materials): archive materials and hide them by default`** ← **do this before applying an import**
- `archived` is a new concept. The **complete** surface, verified by grepping `prisma.material.` and the material-consuming components — the earlier draft of this brief missed four of these:
  - `src/app/api/materials/route.ts` (the list)
  - `src/app/api/materials/available/route.ts` (booking availability)
  - `src/app/api/materials/[id]/components/route.ts` — **missed before**: the bundle-component picker would offer archived children
  - `src/app/api/periods/[id]/materials/route.ts` — **missed before**: booking an archived material must be refused, not merely hidden
  - `src/app/(app)/page.tsx` — **missed before**: the dashboard's "Materialen" stat counts the full list, so importing the advanced file would inflate it from ~103 to ~390
  - `src/app/(app)/materials/labels/page.tsx`, `src/components/materials-tree-pane.tsx`, `materials-filter-bar.tsx`, `material-split-editor.tsx`, `stock-items-sheet.tsx`, `src/hooks/use-materials.ts`, `use-bundle-editor.ts`
  - forward: K4's payback lists (phase 3)
- **Missing one puts 287 archived flightcases in a booking dropdown or a dashboard count.** Enumerate what you covered in the commit body.

**M1.4 — `feat(import): apply an import`**
- `POST /api/materials/import` (module **Materialen: wijzigen**, same as the preview — state the guard explicitly so N2.5's enumeration test passes) — one transaction, auto-creating categories, generating stock items, honouring `archived`.
- **Never let one bad row abort the file**; collect and report skipped rows.
- Must not touch existing bookings' snapshots.

**M1.5 — `feat(materials): import screen with preview and confirm`**
- Upload → preview table → confirm. The preview is mandatory (Q36b); there is no direct-apply path.

**M1.6 — `test(import): cover the real export files`**
- Import the normal file into a seeded DB: 103 materials, 11 categories, correct prices and stock counts, the 5 duplicate codes reported without failing. Import the advanced file: 287 archived, hidden from the tree and the booking picker. Re-import both: no duplicate categories, no duplicate materials.

### Files to read before starting

| File | Why |
|---|---|
| `.plans/data-import-export-design.md` (517 lines, read in full) | Authoritative for M1; §1–§2 define the material mapping, §4 the pipeline, §6–§7 the dirty-data/replace rules |
| `.plans/tools/Export_Equipment_normal.csv`, `..._advanced.csv` | The two real files M1.6 must import; row/ID/code counts independently re-verified below |
| `.plans/tools/xlsx-to-csv.py` (33 lines) | The proof-of-concept reader M1.1's hand-rolled TS reader is modelled on |
| `src/lib/material-code.ts` (14 lines, read in full) | The `nextCode()` bug M1 must fix before any import writes a category-derived code |
| `src/lib/material-code.test.ts` (36 lines, read in full) | **Every one of its 6 cases breaks** once the prefix format changes — see trap below |
| `prisma/seed.ts:331-335`, `:87-101` (`categoryPrefixMap`/`categoryFromCode`) | The existing 2-digit prefix convention the fix must migrate away from |
| `src/app/api/materials/route.ts` (146 lines, read in full) | The material list (no `archived` filter today) and the only caller of `nextCode()` (`:114`) |
| `src/app/api/materials/available/route.ts` (118 lines, read in full) | Booking availability list — needs an `archived` filter |
| `src/app/api/materials/[id]/components/route.ts` (65 lines, read in full) | Bundle-component picker `GET` (`:18-32`) — no `archived` filter on the child list |
| `src/app/api/periods/[id]/materials/route.ts` (71 lines) | Booking a material — needs to refuse archived materials, not just hide them |
| `src/app/(app)/page.tsx` (124 lines, read in full) | Dashboard "Materialen" stat (`:53`) counts the unfiltered list length |
| `prisma/seed-data/materials.csv` | Confirmed **100% code match** with the normal export's 103 codes (independently re-verified below) |

### Verified counts (independently re-verified with a script against the real files)

| | `Export_Equipment_normal.csv` | `Export_Equipment_advanced.csv` |
|---|---|---|
| Columns | 82 | 82 |
| Rows / unique `ID` / unique `Code` | 113 / 104 / 103 | 287 / 287 / 287 |
| `Type of equipment` | 109 Physical item, 1 Physical combination, 3 Virtual combination | 287 Physical combination |
| `Archived` | `0` × 113 | `1` × 287 |
| `Display in planner` | `1` × 113 | `0` × 287 |
| `Stock calculation method` | 16 Serialized, 97 Bulk | 287 Bulk |
| Zero-priced rows (`Rental-/Sales price`) | 4 | 287 |
| Max price | €15,000 | €0 |
| Distinct `Folder (Folder)` values | 11 | 0 (empty for all rows) |
| Codes with >1 row | 5 groups | 0 |

Duplicate-code groups in the normal file, confirmed by script (`ID`, name, stock method per group):

| Code | Rows | Unique `ID`(s) | Name(s) | Method |
|---|---|---|---|---|
| `0501-003` | 2 | `{697}` | Tent 5x10 | Serialized |
| `0201-010` | 5 | `{715}` | Horeca Frigo | Serialized |
| `0501-001` | 4 | `{720}` | Tent 4x8 | Serialized |
| `0501-002` | 2 | `{1266}` | Tent 8x20 | Serialized |
| `9998-902` | 2 | `{707, 708}` | `707` → "Vorken (vis)"; `708` → "Messen (Vis)" | Bulk |

⚠️ **Correction to `.plans/data-import-export-design.md` §2.2**: that document's prose has the two names swapped — it reads "the first-seen `ID` (lowest `ID`, i.e. `707`, **'Messen (Vis)'**) keeps the code; the second (`708`, **'Vorken (vis)'**)…". Independently re-verified against the raw CSV: **`ID 707` is "Vorken (vis)"; `ID 708` is "Messen (Vis)"** — matching the roadmap's own Q58 line (`.plans/2026-08-po-feedback-round2.md:75`: *"ID 707 'Vorken (vis)' vs ID 708 'Messen (Vis)'"*) and this brief's own existing table above (the `Code` row). The **outcome** (lowest `ID` keeps the code) is unaffected by the name swap, but the import report's per-row skip-reason text must name the correct item for each `ID` — use the table above, not the design doc's §2.2 prose.

Combination-type rows (all four, normal file only):

| Code | Name | Type | Method | Qty | Price |
|---|---|---|---|---|---|
| `0201-017` | Schepijs vriezer | Physical combination | Bulk | 1 | €55 |
| `0201-999` | Tap + aciet | Virtual combination | Bulk | 1 | €75 |
| `0401-006` | cocktailtafel met hoes (zwart) | Virtual combination | Bulk | 15 | €8 |
| `0401-011` | Buffettafel met hoes (zwart) | Virtual combination | Bulk | 11 | €8 |

Projected `StockItem` count for the normal-file import (independently computed): **1,631 rows** — 16 from Serialized groups + 1,615 from Bulk groups (1,642 raw bulk quantity across all Bulk `ID`-groups, minus the 27 units belonging to the 3 `Virtual combination` rows that import as empty-recipe bundles with no stock: 1 + 15 + 11). This matches the design doc's own test-plan projection (§11.1) exactly.

`prisma/seed-data/materials.csv`'s 103 codes are a **100% set-equal match** with the normal export's 103 codes (verified by script: `seed-codes − normal-codes = {}`, `normal-codes − seed-codes = {}`).

### Full Rentman → RentFlow column mapping (all 82 columns, brought forward from the design doc's §2.5)

| # | Source column | Target | Notes |
|---|---|---|---|
| 1 | Created on | not imported | Rentman audit metadata |
| 2 | Last change | not imported | |
| 3 | Name (in database) | `Material.name` | |
| 4 | Code | `Material.code` | **match key** (Q36a) |
| 5 | Internal remark | `Material.notes` | populated on 2 rows |
| 6 | External remark | not imported | webshop text, declined |
| 7 | Measuring unit | not imported | declined (Q36c) |
| 8 | In webshop | not imported | |
| 9 | Surface item | not imported | |
| 10–14 | Webshop SEO/description fields | not imported | webshop integration out of scope |
| 15 | Webshop featured product | not imported | |
| 16 | Rental-/Sales price | `Material.dayPrice` | |
| 17 | Margin price | `Material.costPrice` | structural mapping, **0/113 populated in this sample** — not empirically confirmed |
| 18 | Critical stock | not imported | declined (Q36c) |
| 19 | Type of equipment | `Material.isBundle` | not a direct boolean cast — see the `isBundle` rule below |
| 20 | Rental/sales | not imported | uniformly "Rental" |
| 21 | Stock calculation method | drives `StockItem` generation strategy | not stored itself |
| 22 | Display in planner | folds into `Material.archived` | `archived := Archived=="1" OR Display_in_planner=="0"` |
| 23 | Archived | `Material.archived` | |
| 24 | List price | `Material.listPrice` | |
| 25–32 | Volume/Height/Width/Length/Weight/Empty weight/Power/Current | not imported | declined (Q36c) |
| 33 | Default equipment group | not imported | duplicates `Folder` in this export |
| 34 | The equipment can have content | not imported | informational only |
| 35 | Physical/Virtual | not imported | redundant with column 19 here |
| 36 | Content editable in project | not imported | |
| 37 | Restrict actual content | not imported | |
| 38 | Price incl. VAT | not imported | derivable |
| 39 | VAT rate | not imported | uniformly 0.21; RentFlow VAT is a global setting |
| 40 | Has accessories | not imported | |
| 41 | Number of images | not imported | Q34c |
| 42 | Tags | not imported | no tag concept |
| 43 | Current quantity excl. reserved for combinations | not imported | Rentman-specific reservation accounting |
| 44 | Current quantity | drives `StockItem` count for Bulk | not stored itself |
| 45 | Quantity reserved for combinations | not imported | |
| 46–48 | Location fields | not imported | no warehouse-location concept |
| 49 | ID | import bookkeeping only | row-grouping key — never stored on `Material` |
| 50 | Created by | not imported | |
| 51 | Folder (Folder) | `Category.name` + `Category.prefix` | auto-created (Q36b); requires the `nextCode()` fix below |
| 52–54 | Factor group, Discount group, VAT class | not imported | declined |
| 55 | Main image | not imported | Q34c |
| 56–57 | Ledger credit/debit | not imported | out of scope |
| 58–59 | Created on/Last change (Serial number) | not imported | |
| 60 | Display name (Serial number) | `StockItem.identifier` fallback #2 | mirrors `seed.ts:239` |
| 61 | Manufacturer serial number (Serial number) | `StockItem.identifier` fallback #1 | mirrors `seed.ts:239` |
| 62 | Date of purchase | not imported | declined |
| 63 | Active (Serial number) | folds into `StockItem.notes` | `"Inactive in source"` when `0`, mirrors `seed.ts:242` |
| 64 | Remark (Serial number) | `StockItem.notes` | |
| 65 | Internal reference (Serial number) | `StockItem.identifier` fallback #3 | mirrors `seed.ts:239` |
| 66–67 | Guarantee/Replacement date | not imported | |
| 68 | Current book value (Serial number) | not imported | declined — distinct from `costPrice` |
| 69 | Tags (Serial number) | not imported | |
| 70 | Seal (Serial number) | not imported | |
| 71 | Actual content from (Serial number) | not imported | empty in both files |
| 72 | Combination structure (Serial number) | **not populated in either export** | absence is why combination rows import as empty shells |
| 73 | ID (Serial number) | import bookkeeping only | uniquely identifies the exemplar row |
| 74 | Created by (Serial number) | not imported | |
| 75 | Equipment (Serial number) | not imported | redundant with column 3 |
| 76 | Supplier (Serial number) | not imported | declined |
| 77–78 | Assigned to, Managed by | not imported | |
| 79 | Main image (Serial number) | not imported | Q34c |
| 80 | On subproject (Serial number) | not imported | |
| 81–82 | Lost, In repair (Serial number) | not imported | declined |

`isBundle` rule (not a 1:1 cast of column 19): `Virtual combination` → `isBundle=true`, zero `StockItem`s generated (empty-recipe bundle, contents entered by hand — `Combination structure` is empty for every row in both files). `Physical combination` → `isBundle=false`, imported as an ordinary material with real generated stock — this is the rule that keeps the advanced file's 287 rows from becoming 287 empty unbookable bundles.

### Preview payload shape (brought forward verbatim from the design doc §5 as the contract M1.2 implements)

```ts
interface ImportPreview {
  entity: "materials" | "people" | "clients" | "locations";
  mode: "update" | "replace";
  sourceFormat: "rentflow" | "rentman-equipment";
  totals: { new: number; updated: number; unchanged: number; skipped: number; errored: number };
  rows: ImportRowPreview[];
  blockers?: ReplaceBlocker[];  // absent in phase 2 — replace mode ships in P3 (phase 4)
}

interface ImportRowPreview {
  line: number;                 // 1-based source row number, header excluded
  classification: "new" | "updated" | "unchanged" | "skipped" | "errored";
  matchKey: string | number | null;
  summary: string;               // e.g. "Tent 5x10 (0501-003)"
  changes?: { field: string; from: unknown; to: unknown }[];  // "updated" only
  reason?: string;                // always present for skipped/errored
}
```
In phase 2 (M1), `mode` is always `"update"` and `blockers` is never populated — the `"replace"` branch and `ReplaceBlocker` type exist in the shape for P3 (phase 4) to fill in without redefining the interface, per the design doc's §4.2/§12 sequencing recommendation.

### Concrete traps

- **All 6 cases in `src/lib/material-code.test.ts` break** once `nextCode()`'s prefix format changes from 2-digit to 4-digit. Every existing case calls `nextCode("04", ...)` / `nextCode("03", ...)` and expects a 4-digit-prefixed result (`"0401-001"`) — under the new pattern `^${prefix}-(\d{3})$`, `nextCode("04", [])` returns `"04-001"`, not `"0401-001"`. Rewrite this test file's calls to pass 4-digit prefixes (`nextCode("0401", [])`) in the **same commit** as the regex change, or `npm test` goes red. Add a new case using a real shape (`nextCode("0501", ["0501-001", "0501-002"])` → `"0501-003"`) as the regression the design doc calls for.
- **`src/app/api/materials/route.ts` is 146 lines** (`wc -l`, verified) — only 4 lines of headroom before the 150-line limit. Adding an `archived` filter to `GET` risks pushing this over; consider a shared query-builder helper instead of inline logic.
- **`src/components/material-split-editor.tsx` is 403 lines** (`wc -l`, verified) — already dramatically over the 150-line limit before M1.3 touches it. Any archived-filtering change here must not be an excuse to grow it further; extract if touching this file at all.
- **`src/components/stock-items-sheet.tsx` is 171 lines** (`wc -l`, verified) — also already over budget.
- No xlsx/csv library exists in `package.json` today (grepped: zero hits for `xlsx`/`exceljs`/`papaparse`/`sheetjs`) — confirms the design doc's "hand-roll, no dependency" recommendation is the only option consistent with the project's existing convention.
- `src/app/api/materials/[id]/components/route.ts`'s `GET` (`:18-32`) has no `archived` filter on `child` — confirmed by direct read; a bundle-component picker built on this endpoint today would offer archived children once any material has `archived=true`.
- `src/app/(app)/page.tsx:53` — `value: materialsQuery.data?.length ?? 0` — confirmed a raw `.length` on the full `/api/materials` response; importing the advanced file without first fixing this inflates the dashboard tile from ~103 to ~390, exactly as the brief warns.

### Verification commands

```bash
npx tsc --noEmit && npm run lint
npm test -- src/lib/material-code.test.ts     # must be updated, not just re-passing by luck
npm test
npm test -- --grep "import"                    # once M1.1-M1.6 land
```
Success (per the design doc's test plan §11, achievable in phase 2's `update`-only scope): normal-file import yields 103 materials, 11 categories, 1,631 `StockItem` rows, the `9998-902` pair reported with the correct names (`707`→Vorken (vis) keeps the code, `708`→Messen (Vis) skipped/renumbered); advanced-file import yields 287 materials, all `archived=true`, absent from `materials/route.ts`'s default list, `materials/available/route.ts`, the bundle-component picker, and the dashboard's "Materialen" tile; re-importing either file twice produces `new: 0` on the second pass with no duplicate categories or codes.

### Definition of done

- [ ] `nextCode()` fixed (4-digit prefix pattern) as its own reviewable commit, with `material-code.test.ts` rewritten and a regression case added, **before** any import writes a category-derived code
- [ ] M1.1: entity-agnostic pipeline + material adapter + xlsx reader, pure functions, unit-tested against both real files, zero DB writes
- [ ] M1.2: preview endpoint, `new`/`updated`/`unchanged`/`skipped`/`errored` classification, never writes
- [ ] M1.3: `archived` concept covers **all** surfaces listed in the commit above, enumerated explicitly in the commit body
- [ ] M1.4: apply endpoint, one transaction, auto-creates categories, never aborts the whole file on one bad row
- [ ] M1.5: upload → preview → confirm UI, no direct-apply path
- [ ] M1.6: both real files pass the exact figures above; re-import idempotency confirmed

---

## J2a — Make the cost print a document

**Branch:** `j2a-cost-document` · independent · skill: `design`

`src/components/project-costs-tab.tsx`'s print view (`:71-79`) does **not** use `DocumentHeader`, so unlike the pakbon and callsheet it prints with no company name, address, BTW number, IBAN or logo. This is the literal answer to "facturen moeten properder", and it ships before the real invoice entity (J2b, phase 3).

**J2a.1 — `feat(documents): printable cost overview with company and client details`**
- New printable route `/projects/[id]/kosten` reusing `PrintLayout` + `DocumentHeader` (`src/components/print/`).
- Add the client billing block — `Client` already has `address`, `postalCode`, `city`, `vatNumber` (`prisma/schema.prisma:21-33`), but only the name is passed into `meta` today (`document-header.tsx:74-106`).
- Include the project number (= id, round-1 Z3) and the date. Travel lines sit outside the subtotal per phase 0's J1.
- ⚠️ **`DocumentHeader` fetches `/api/settings`**, which phase 1 gated at `Instellingen: lezen` (N2 subtlety 3). Whoever must print needs that access — verify with a non-admin role and, if it fails, say so in the report rather than loosening the guard.

**J2a.2 — `feat(documents): print styling for the cost overview`**
- Clean line/subtotal/BTW/total typography; no interactive controls (discount popovers, price editors) bleeding into print. Print CSS consolidation is J3 in phase 3 — do not do it here, but do not add a fourth stylesheet either: reuse `PrintLayout`'s.

---

## Phase 2 exit report

1. Branch + commit list per item.
2. **Postgres round-trip evidence for H1.3** (Brussels hours on a UTC server) — or an explicit statement it could not be run.
3. The L2.1 backfill result: how many assignments matched a function by name, and the list of unmatched ones for the PO to map.
4. The M1.6 import result against both real files, including the 5 duplicate codes and the 4 bundle shells needing manual contents.
5. Confirmation that all new money fields were added to `src/lib/redact.ts` and that N2.5's guard test still passes with the new routes.
6. Confirmation that day-billed figures are unchanged (H5.3's regression) and that historical snapshots were not recomputed (L1.2).
7. For the PO to check: book yourself 08:00–17:00 on one project and 18:00–23:00 on another the same day; force a deliberate double booking and confirm it is flagged; import the equipment file and confirm the archived flightcases stay hidden.
