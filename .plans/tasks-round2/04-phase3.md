# Phase 3 — Invoices, business figures, planning granularity

> Read `00-README.md` first. Source decisions: `.plans/2026-08-po-feedback-round2.md` (Q23–Q25c, Q26–Q29, Q48, Q20, Q21).
> **v2 — one adversarial review round folded in (7 findings, 2 high-severity).**
> 10 items + 1 DDL commit, ~29 commits.
> **Gate to start:** phase 2 merged · ✅ **`.plans/invoice-design.md` is written — read it in full; it is authoritative over this summary** (blocks J2b, and K1's invoiced series depends on J2b).

## Order

```
DDL-3 (alone, first: invoice models + chart seed data)
  ├─► J2b (invoices) ──────────────► K1 (stats: invoiced series needs invoices)
  │                                    ├─► K4 (payback)
  │                                    ├─► K2 (figures page) ──► K3 (dashboard tiles)
  ├─► I1 (view switcher) ──► I2 (period bucketing) ──► I3 (person view)
  └─► J3 (print CSS consolidation)     [after J2b's document exists]
```

**One worker owns the K chain** (K1 → K4 → K2 → K3): they share the stats contract. **One worker owns the I chain.** J2b is large enough to be its own worker and its own multi-session effort.

## Inherited obligations

1. **Every new route needs `requireModule(...)`** or N2.5's enumeration test fails. New routes here: `/api/stats` (**Cijfers**), `/api/invoices/*` (**Kosten/Facturen**).
2. **Every new money field goes into `src/lib/redact.ts`** and through Y1's serializer. Invoice totals and payback figures are commercial data: a role with `Kosten/Facturen: geen` must receive none of it, and `Cijfers` access alone must not become a side door to rates.
3. **N5 scoping:** `/api/stats` was registered as a forward entry in N5.4's enumeration test. An own-scoped user's figures must cover only their own bookings — or, if that makes no sense for a freelancer, deny `Cijfers` to scoped roles outright and say so. Decide in K1.1 and write it down.
4. **`prisma/seed.ts` belongs to the DDL-3 worker** — see DDL-3 below for why the chart seed data lands there and not in K2.
5. **`src/lib/pricing.ts`'s phase-3 owner is the J2b worker.** J2b.1 reuses and extends its cost maths, and K1/K4 may also want new exports — two workers in a "one owner per phase" critical file is exactly what `00-README.md` forbids. The K-chain worker therefore requests any `pricing.ts` addition from the J2b worker rather than editing it, or the two items are assigned to the same person.

---

## DDL-3 — invoice models and chart-grade seed data `lands alone, first`

**Branch:** `ddl3-invoices` · **one commit** (two if the seed volume makes review unwieldy — then `feat(db):` then `chore(seed):`)

**`feat(db): add invoice models`**

Exact model shape comes from `.plans/invoice-design.md` (approved before this starts). Both schemas + seed. The design doc's data-model section is authoritative; this brief only records the constraints it must satisfy:

- **Four models, not two** (the design doc found `Payment` and `InvoiceCounter` missing from this list — J2b's own commits never touch the schema, so they must land here): `Invoice`, `InvoiceLine`, `Payment` (partial payments, Q52) and `InvoiceCounter` (the two gapless series, Q51).
- **Deposit + final invoicing (Q50):** a project carries several invoices; an `kind` field separates voorschot / eindfactuur / creditnota, and the final invoice deducts what was already invoiced. Credit notes use a **separate number series** (`CN-`).
- `Invoice` and `InvoiceLine`, with `number String @unique`, invoice/due dates, `status` (String + TS union + zod — **no Prisma enum**), snapshotted client identity (name, address, VAT) so a later client edit cannot rewrite a sent invoice, `creditNoteOfId` self-relation, and money as `Decimal` (PG) / `Float` (dev).
- **`InvoiceLine.vatRate` per line**, even though Q25a chose a single global setting — this is what makes per-line VAT a later config change rather than a migration.
- A numbering counter mechanism per the design doc (gapless, sequential, generated inside the finalising transaction).
- Settings keys for payment terms, bank account holder, invoice number format, invoice footer, and the BTW rate (Q25a/Q25b) — extend `SETTING_KEYS` in `src/lib/settings.ts:3-11`.
- `src/types/index.ts`: the client-side mirror for all of the above (hand-maintained, not generated).
- **Also required by K4 — snapshot the bundle component ratio.** `MaterialComponent` carries only `quantity` (`prisma/schema.prisma:205-214`) and component lines are booked at `dayPriceSnapshot: 0` (`src/lib/booking.ts:153-154`). K4's pro-rata split therefore has nothing historical to divide by, and deriving the weight from the **live** `Material.dayPrice` means any later price edit silently rewrites the payback attribution of every past booking. Add a `PeriodBundleBookingComponent { id, bundleBookingId, materialId, quantity, dayPriceAtBooking Decimal }` row written at booking time (extend `bookBundleMaterial` in `src/lib/booking.ts:120-160`), or an equivalent stored ratio on `PeriodBundleBooking`. Without this, K4 cannot be historically stable — and it must land in this migration because DDL-3 is the phase's only one.

**Chart-grade seed data ships in this commit too.** K2 cannot be judged against the current seed: 4 projects, 6 periods, **zero** `PeriodBundleBooking` and **zero** `PersonTravelCost` rows. Extend `prisma/seed.ts` to roughly **20 projects across 12 months, 40+ periods, travel costs on ~30% of person bookings, at least 2 booked bundles** (needed for K4's bundle-split path to be exercised at all), day rates in the existing €200–450 range, and a handful of invoices in mixed statuses. It lands here rather than in K2 because `seed.ts` has one owner per phase.

- **Verify:** `npm run db:dev:reset` succeeds and produces the described volumes; `docker compose run --rm app sh -c "npx prisma migrate deploy"` applies cleanly; existing data untouched.

**Files to read before starting** (all verified against the current repo):

| File | Why |
|---|---|
| `.plans/invoice-design.md` §1 (lines 22–234) | Exact model shapes for both schemas — reproduced below, do not re-derive them |
| `prisma/schema.prisma` | Anchor points: `Client` `:21-33`, `Project` `:74-91`, `MaterialComponent` `:205-214`, `PeriodStockItem` `:189-203` (`bundleBookingId Int?` at `:197`), `PeriodBundleBooking` `:216-225`, `PeriodPerson.dayPriceSnapshot`/`discountPct` `:232-233` |
| `prisma/schema.dev.prisma` | Structurally line-for-line parallel to `schema.prisma` today (verified: every model above sits at the identical line range in both files) — do not assume this stays true after your edit; re-diff before finishing |
| `src/lib/booking.ts:116-163` (`bookBundleMaterial`) | Where the new `PeriodBundleBookingComponent` row must be written — one row per component per bundle booking, alongside the existing `periodStockItem.createMany` at `:149-156` |
| `src/lib/settings.ts:3-11` | `SETTING_KEYS` array to extend with the six invoice keys |
| `prisma/seed.ts` (563 lines total) | Current volumes to grow from: exactly 4 `prisma.project.create` calls (`:391,412,429,446`) producing 6 periods total (3 in `festivalMain` + 1 each in the other three, `:404-405,423,441,457`); zero `PersonTravelCost` rows anywhere in the file; `prisma.periodBundleBooking.deleteMany()` at `:263` is a reset call only — no `.create` for it exists, confirming zero bundle bookings seeded today |

**Current behaviour (verified quotes):**

`MaterialComponent` today carries only a quantity, no price snapshot (`prisma/schema.prisma:205-214`):
```prisma
model MaterialComponent {
  id       Int      @id @default(autoincrement())
  parentId Int
  childId  Int
  quantity Int      @default(1)
  parent   Material @relation("BundleParent", fields: [parentId], references: [id], onDelete: Cascade)
  child    Material @relation("BundleChild", fields: [childId], references: [id], onDelete: Cascade)
  @@unique([parentId, childId])
}
```

`bookBundleMaterial` snapshots every component line at zero (`src/lib/booking.ts:149-156`):
```ts
      await txClient.periodStockItem.createMany({
        data: chosen.map((stockItemId) => ({
          periodId: args.periodId,
          stockItemId,
          dayPriceSnapshot: 0,
          bundleBookingId: bBooking.id,
        })),
      });
```
This confirms the brief's claim above verbatim — there is genuinely nothing to divide K4's payback by without the new snapshot row.

**Exact model blocks to add — Postgres (`prisma/schema.prisma`, Decimal money), from `.plans/invoice-design.md:26-129`:**
```prisma
model Invoice {
  id                Int       @id @default(autoincrement())
  kind              String    @default("invoice")   // "invoice" | "creditnota"
  series            String    @default("invoice")   // "invoice" | "credit"
  status            String    @default("concept")   // "concept" | "verzonden" | "betaald"
  invoiceRole       String    @default("standalone") // "deposit" | "final" | "standalone"
  number            String?
  year              Int?
  projectId         Int?
  clientId          Int
  creditNoteOfId    Int?
  clientName        String
  clientAddress     String?
  clientPostalCode  String?
  clientCity        String?
  clientVatNumber   String?
  invoiceDate       DateTime?
  dueDate           DateTime?
  paymentReference  String?
  currency          String    @default("EUR")
  subtotalExcl      Decimal   @default(0) @db.Decimal(10, 2)
  travelExcl        Decimal   @default(0) @db.Decimal(10, 2)
  deductionExcl     Decimal   @default(0) @db.Decimal(10, 2)
  vatAmount         Decimal   @default(0) @db.Decimal(10, 2)
  totalIncl         Decimal   @default(0) @db.Decimal(10, 2)
  depositType       String?
  depositPercentage Decimal?  @db.Decimal(5, 2)
  depositBasisExcl  Decimal?  @db.Decimal(10, 2)
  notes             String?
  footer            String?
  createdAt         DateTime  @default(now())
  finalizedAt       DateTime?

  client            Client        @relation(fields: [clientId], references: [id])
  project           Project?      @relation(fields: [projectId], references: [id])
  creditNoteOf      Invoice?      @relation("CreditNoteOf", fields: [creditNoteOfId], references: [id])
  creditNotes       Invoice[]     @relation("CreditNoteOf")
  lines             InvoiceLine[]
  payments          Payment[]

  @@index([projectId])
  @@index([clientId])
  @@index([status])
  @@index([creditNoteOfId])
}

model InvoiceLine {
  id             Int      @id @default(autoincrement())
  invoiceId      Int
  section        String?
  kind           String              // "person"|"material"|"bundle"|"travel"|"deduction"|"deposit"|"manual"
  description    String
  quantity       Decimal  @db.Decimal(10, 2)
  unit           String              // "dag"|"uur"|"stuk"
  unitPrice      Decimal  @db.Decimal(10, 2)
  vatRate        Decimal  @db.Decimal(5, 2)
  lineTotalExcl  Decimal  @db.Decimal(10, 2)
  sortOrder      Int
  sourceKind     String?
  sourceId       Int?

  invoice        Invoice  @relation(fields: [invoiceId], references: [id], onDelete: Cascade)

  @@index([invoiceId])
}

model Payment {
  id          Int       @id @default(autoincrement())
  invoiceId   Int
  amount      Decimal   @db.Decimal(10, 2)
  paidAt      DateTime
  method      String?
  reference   String?
  notes       String?
  createdAt   DateTime  @default(now())

  invoice     Invoice   @relation(fields: [invoiceId], references: [id], onDelete: Cascade)

  @@index([invoiceId])
}

model InvoiceCounter {
  series   String
  year     Int
  lastSeq  Int     @default(0)

  @@id([series, year])
}
```
Plus two relation-only additions: `Client` gains `invoices Invoice[]`; `Project` gains `invoices Invoice[]`.

**Exact model blocks — SQLite (`prisma/schema.dev.prisma`, Float money), from `.plans/invoice-design.md:140-227`** — identical names/nullability/defaults/indexes/relations; every `Decimal @db.Decimal(x,y)` becomes plain `Float`:
```prisma
model Invoice {
  id                Int       @id @default(autoincrement())
  kind              String    @default("invoice")
  series            String    @default("invoice")
  status            String    @default("concept")
  invoiceRole       String    @default("standalone")
  number            String?
  year              Int?
  projectId         Int?
  clientId          Int
  creditNoteOfId    Int?
  clientName        String
  clientAddress     String?
  clientPostalCode  String?
  clientCity        String?
  clientVatNumber   String?
  invoiceDate       DateTime?
  dueDate           DateTime?
  paymentReference  String?
  currency          String    @default("EUR")
  subtotalExcl      Float     @default(0)
  travelExcl        Float     @default(0)
  deductionExcl     Float     @default(0)
  vatAmount         Float     @default(0)
  totalIncl         Float     @default(0)
  depositType       String?
  depositPercentage Float?
  depositBasisExcl  Float?
  notes             String?
  footer            String?
  createdAt         DateTime  @default(now())
  finalizedAt       DateTime?

  client            Client        @relation(fields: [clientId], references: [id])
  project           Project?      @relation(fields: [projectId], references: [id])
  creditNoteOf      Invoice?      @relation("CreditNoteOf", fields: [creditNoteOfId], references: [id])
  creditNotes       Invoice[]     @relation("CreditNoteOf")
  lines             InvoiceLine[]
  payments          Payment[]

  @@index([projectId])
  @@index([clientId])
  @@index([status])
  @@index([creditNoteOfId])
}

model InvoiceLine {
  id             Int      @id @default(autoincrement())
  invoiceId      Int
  section        String?
  kind           String
  description    String
  quantity       Float
  unit           String
  unitPrice      Float
  vatRate        Float
  lineTotalExcl  Float
  sortOrder      Int
  sourceKind     String?
  sourceId       Int?

  invoice        Invoice  @relation(fields: [invoiceId], references: [id], onDelete: Cascade)

  @@index([invoiceId])
}

model Payment {
  id          Int       @id @default(autoincrement())
  invoiceId   Int
  amount      Float
  paidAt      DateTime
  method      String?
  reference   String?
  notes       String?
  createdAt   DateTime  @default(now())

  invoice     Invoice   @relation(fields: [invoiceId], references: [id], onDelete: Cascade)

  @@index([invoiceId])
}

model InvoiceCounter {
  series   String
  year     Int
  lastSeq  Int     @default(0)

  @@id([series, year])
}
```

`PeriodBundleBookingComponent` is **not** in the design doc's own model list (§1.1/§1.2 above list only four models) — it is this brief's own addition (line 46 above), so its exact shape is this worker's to finalise. Minimum viable shape, matching the sketch already given: `{ id Int @id @default(autoincrement()), bundleBookingId Int, materialId Int, quantity Int, dayPriceAtBooking Decimal (PG) / Float (dev), bundleBooking PeriodBundleBooking @relation(...), material Material @relation(...) }`, with `@@index([bundleBookingId])`. Write one row per component **per booking call** (not per unit) inside `bookBundleMaterial` (`booking.ts:116-163`), snapshotting the resolved child `dayPrice` at that moment — mirrors the same snapshot-at-booking-time convention already used one line above it for `dayPriceSnapshot: 0`.

**Traps:**
- The K4-critical fields `Material.archived`, `Material.costPrice`, `Material.listPrice`, `Material.revenueBefore`, `StockItem.costPrice` **do not exist in `prisma/schema.prisma` today** (grepped, zero hits). They are added by phase 2's M1 item (`.plans/tasks-round2/03-phase2.md:49-50`: `Material` gains `archived Boolean @default(false)`, `costPrice Decimal?`, `listPrice Decimal?`, `revenueBefore Decimal?`; `StockItem` gains `costPrice Decimal?`). Phase 2 merging is DDL-3's own gate, so they should exist by the time you start — **re-read the actual schema for their exact names before writing K4's SQL/Prisma calls against them**; do not trust this brief's spelling blindly, since a different worker authored that migration.
- Both schema files must gain an identical field set. A one-file miss (e.g. forgetting `@@index([creditNoteOfId])` in `schema.dev.prisma`) is not caught by `tsc` — each schema generates its own client — only by actually running both `npm run db:dev:migrate` and the Postgres diff/deploy.
- `seed.ts` is already 563 lines; growing it to ~20 projects will make the file very large. It already externalises bulk data to `prisma/seed-data/materials.csv` (`seed.ts:26-28`) — consider the same move for new invoice/travel-cost fixtures, for reviewability, not because of the 150-line rule (which does not apply to `prisma/`).

**Verification commands:**
```bash
npm run db:dev:reset
npx tsc --noEmit
docker compose up -d db
npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma \
  --shadow-database-url "postgresql://rentflow:rentflow@localhost:5432/rentflow" \
  --script > prisma/migrations/$(date +%Y%m%d%H%M%S)_invoices/migration.sql
docker compose run --rm app sh -c "npx prisma migrate deploy"
```
Success = `db:dev:reset` completes with the described volumes; `tsc` zero errors on both generated clients; the migration diff produces SQL creating exactly the four new tables + two relation columns; `migrate deploy` applies cleanly against a fresh Postgres.

**Definition of done:**
- [ ] `Invoice`, `InvoiceLine`, `Payment`, `InvoiceCounter` in both schema files, field-for-field as above
- [ ] `Client.invoices` / `Project.invoices` relation arrays added to both schemas
- [ ] `PeriodBundleBookingComponent` (or equivalent) added and written inside `bookBundleMaterial`
- [ ] `SETTING_KEYS` extended with the six invoice keys (`settings.ts:3-11`)
- [ ] `src/types/index.ts` hand-mirrors every new type (design doc §1.3)
- [ ] `prisma/seed.ts` reaches ~20 projects/12 months/40+ periods/travel costs on ~30% of person bookings/≥2 booked bundles, plus the invoice status/kind spread from design doc §9 (concept, verzonden-not-due, verzonden-overdue, partially-paid, betaald, a deposit+final pair, a creditnota)
- [ ] `npm run db:dev:reset` and the Postgres migrate-deploy both succeed
- [ ] pre-existing seeded data (the 4 original projects) still present and unchanged after reset

---

## J2b — Real invoices `XL` `design doc first` `expect multiple sessions`

**Branch:** `j2b-invoices` · ⛔ **two gates before the first commit:**
1. **`.plans/invoice-design.md` approved** by the PO.
2. **The accountant has answered on Peppol (Q25c).** Belgium's structured B2B e-invoicing mandate started 1 January 2026. If it applies to these invoices, J2b is a *compliance* project — structured UBL over an access point, delivery status tracking — not the document project described below, and it must be re-scoped with its own design round before any code. If it does not apply, proceed exactly as written; the model is Peppol-shaped either way so nothing is wasted.
3. **The accountant has answered on travel-cost VAT (Q22).** J1 (phase 0) already implemented the decided treatment in one configurable place; confirm it before invoices reach clients, and adjust that one place if the answer differs.

Decided: RentFlow becomes the invoicing system (Q23) — numbered invoices, invoice/due dates, status, **frozen** amounts, credit notes, an overview page. Lines **grouped per period** (Q24). BTW from a setting but stored per line (Q25a). **Peppol-shaped but not Peppol-connected** (Q25c). Travel outside the subtotal, inside the total (Q22).

Current state: no invoice feature exists at all (`factuur|invoice` → zero hits in `src/`). The nearest artifact is the Kosten tab, and J2a (phase 2) already gave it a proper printable document with company and client details.

**J2b.1 — `feat(invoices): generate draft invoice lines from a project`**
- A pure library function: project + periods → grouped draft lines (people, materials, travel), reusing `src/lib/pricing.ts` rather than reimplementing any cost maths. Unit-tested against a seeded project. No persistence yet.

**J2b.2 — `feat(invoices): create and store draft invoices`**
- `POST /api/invoices` (from a project), `GET /api/invoices`, `GET /api/invoices/[id]` — module **Kosten/Facturen**. Drafts carry **no number** yet.

**J2b.3 — `feat(invoices): allocate gapless sequential numbers on finalisation`**
- Number assigned inside the transaction that moves `concept` → `verzonden`, per the design doc's counter mechanism. Never at draft time, never reused; deleting a draft must leave no hole.
- **Test concurrency explicitly against Postgres, not the SQLite dev DB.** A gapless counter needs row-level locking; SQLite serialises writes behind a file lock, so the same test is either a false green (no real race exercised) or a flaky red (`SQLITE_BUSY`). Use the compose Postgres. ⚠️ **`src/lib/booking.integration.test.ts` is not the template** — despite its name it runs against throwaway SQLite via `PrismaLibSql`. This needs a new Postgres-only test file; the design doc specifies it.

**J2b.4 — `feat(invoices): freeze a sent invoice`**
- Enforce immutability **at the API**: once status leaves `concept`, lines and totals cannot change, and editing the underlying booking, rate or project must not alter the invoice. Test that directly — it is the entity's whole purpose.

**J2b.5 — `feat(invoices): deposit and final invoices`**
- Voorschot by fixed amount **or** percentage (Q50), chosen per invoice, with a default percentage in settings. The eindfactuur bills the remainder, deducting what was already invoiced. Follow the design doc's worked example (full lines + a deduction line, so VAT is not double-charged).

**J2b.6 — `feat(invoices): record payments`**
- Partial payments per invoice with amount and date (Q52); remaining balance derived. `gedeeltelijk betaald` and `vervallen` are **computed at read time**, never persisted.

**J2b.7 — `feat(invoices): credit notes`**
- A correction creates a linked credit note (`creditNoteOfId`); the original stays untouched. Define how totals and reporting treat the pair (K1 must not double-count).

**J2b.8 — `feat(invoices): overview page`**
- List with status/client filters, create-from-project flow, status transitions, credit-note action. Extract components — the 150-line limit applies.

**J2b.9 — `feat(invoices): printable invoice document`**
- Reuse `PrintLayout` + `DocumentHeader` and J2a's layout. Sections per period (Q24), travel lines below the subtotal, VAT summary per rate, payment terms, IBAN + account holder, footer.
- Keep document generation **behind a small interface** so a UBL/XML emitter can be added beside the PDF path later without touching the routes (Q25c).

**J2b.10 — `feat(settings): invoice settings`**
- Payment terms, bank account holder, number format, footer, BTW rate, **default deposit percentage** — wired into `src/components/settings-form.tsx` (163 lines today: extract rather than exceed 150).

**Out of scope, explicitly:** Peppol/UBL emission, access-point integration, delivery tracking, payment reconciliation, recurring invoices, multi-currency, dunning.

**Files to read before starting** (in addition to the design doc, read in full per the gate above):

| File | Why |
|---|---|
| `src/lib/pricing.ts` (full, 156 lines) | `personLineCost` (`:58-60`), `materialLineCost`/`lineCost` (`:37-56`), `periodMaterialsCost` (`:81-91`), `projectCostSummary` (`:93-115`) are the only cost maths J2b.1 may call — never hand-roll these |
| `src/lib/grouping.ts` (full, 115 lines) | `groupMaterialAssignments` (`:43-68`) is what J2b.1 reuses for flat-material lines, exactly as `project-costs-tab.tsx:85,150` does today |
| `src/components/cost-summary.tsx` (105 lines) | `CostSummary`/`PeriodSubtotals` is the existing pattern `invoice-summary.tsx` extends (design doc §8.1) |
| `src/components/cost-line-row.tsx` (115 lines) | `PersonCostRow`/`MaterialGroupCostRow` — the row-component pattern `invoice-line-row.tsx` mirrors |
| `src/components/print/print-layout.tsx` (58 lines) and `src/components/print/document-header.tsx` (109 lines) | Reused verbatim by J2b.9's print page |
| `src/lib/api-auth.ts` (52 lines) | `conflict()` (`:42-44`) is the 409 helper `assertDraftMutable` must call; no `requireModule` exists yet in this file today — it is added by phase 1's N2 before this phase starts, confirm its exact signature once phase 1 has merged |
| `src/lib/booking.integration.test.ts` (202 lines) | Read it to see **why it is not usable** as J2b.3's template (see trap below), not to copy from |
| `src/components/settings-form.tsx` (163 lines) | The file J2b.10 splits — read in full before touching it |
| `src/components/sidebar.tsx` | `BASE_LINKS` array (`:22-30`) J2b.8 extends |
| `src/lib/settings.ts` (62 lines) | `getSettings`/`setSettings` (`:14-38`) need **no logic change** — they already filter against `SETTING_KEYS` generically |

**Current behaviour (verified quotes):**

`settings-form.tsx` today has exactly the 7 company fields and is already over the 150-line limit (163 lines):
```ts
const schema = z.object({
  companyName: z.string().optional(),
  companyAddress: z.string().optional(),
  companyPostalCode: z.string().optional(),
  companyCity: z.string().optional(),
  companyPhone: z.string().optional(),
  companyVat: z.string().optional(),
  companyIban: z.string().optional(),
});
```
`GET`/`PUT /api/settings` today (`src/app/api/settings/route.ts:11-20,22-32`):
```ts
export async function GET() {
  const user = await requireAuth().catch(() => null);
  if (!user) return unauthorized();
  ...
}
export async function PUT(req: NextRequest) {
  const auth = await requireRole("ADMIN").catch(() => null);
  ...
}
```
`GET` is `requireAuth()`-only — no role/module check — and already returns `companyIban`; extending it with bank/BTW settings inherits the same exposure (design doc §1.4's flagged risk, fixed only once phase 1's module matrix lands).

`sidebar.tsx`'s current `BASE_LINKS` (`:22-30`, 8 entries: `/`, `/projects`, `/planning`, `/people`, `/materials`, `/clients`, `/locations`, plus `/users`/`/settings` further down) has no Facturen entry yet.

`booking.integration.test.ts` stubs a throwaway SQLite file, not Postgres (`:3,10`):
```ts
vi.stubEnv("DATABASE_URL", `file:/tmp/booking-integration-init.db`);
...
import { PrismaLibSql } from "@prisma/adapter-libsql";
```
`prisma/seed.ts:8-14`'s adapter-selection pattern is the correct template for the new Postgres-only test file instead:
```ts
const url = process.env.DATABASE_URL ?? "";
const adapter = url.startsWith("file:")
  ? new PrismaLibSql({ url })
  : new PrismaPg({ connectionString: url });
```

**Per-commit shape and design-doc section** (design doc section numbers refer to `.plans/invoice-design.md`; the ten commit IDs below are this brief's own, keep them exactly):

| Commit | Governing section | API / file shape |
|---|---|---|
| **J2b.1** | §5 (lines 500–550) | New `src/lib/invoice-lines.ts` (~120 lines). `generateDraftInvoiceLines(periods, opts): DraftInvoiceLine[]` — `opts: { invoiceRole, vatRate, depositType?, depositValue?, priorDeposits?, projectLabel }`. This single function already implements **all three roles** — standalone/final grouped-by-period, the deposit single-line, and the final-role deduction lines — per §5 in full. No DB access (pure function); unit-tested in `src/lib/invoice-lines.test.ts` against a seeded project (design doc §10) |
| **J2b.2** | §7 routes table | `POST /api/invoices` (write) — body `{ projectId, invoiceRole, depositType?, depositValue? }` → `201 Invoice`. `GET /api/invoices` (read) — query `?status=&clientId=&projectId=&kind=`, all optional → `200 Invoice[]`. `GET /api/invoices/[id]` (read) → `200 Invoice`. Resolves `depositBasisExcl` via `projectCostSummary` (`pricing.ts:93-115`); for `invoiceRole: "final"` fetches prior non-concept deposit invoices + their credit notes and computes `netInvoicedExcl` (§5, formula below) to pass as `priorDeposits` |
| **J2b.3** | §2 (numbering) | New `src/lib/invoice-numbering.ts` (~50 lines) — atomic `INSERT … ON CONFLICT … DO UPDATE … RETURNING "lastSeq"` inside the same transaction as `POST /api/invoices/[id]/finalize` (write) → `200 Invoice`, `409` if already non-concept. Both `series ∈ {"invoice","credit"}` wired from this commit even though credit notes don't exist until J2b.7. **Postgres-only** concurrency test, `src/lib/invoice-numbering.postgres.test.ts` (§2.4/§10) |
| **J2b.4** | §3 (freezing) | Shared guard `assertDraftMutable(invoice)` in `src/lib/invoices.ts`, returning `conflict("Factuur is al verzonden — niet meer te wijzigen")` (409, via `api-auth.ts:42-44`'s existing `conflict()`) whenever `status !== "concept"`. Applied to every line/total-mutating route so far. Mandatory regression test per §3's last paragraph |
| **J2b.5** | §4 (worked example) + §5's deposit/final branches (already built in J2b.1) | Exercises `POST /api/invoices` end-to-end for `invoiceRole: "deposit"` and `"final"`; the acceptance test **must** reproduce the worked numeric example below exactly |
| **J2b.6** | §6 (payments/status) | New `src/lib/invoice-status.ts` (~60 lines): `resolveInvoiceDisplayStatus` (priority table §6.2), `remainingBalance` (§6.1), `netInvoicedExcl`. `POST /api/invoices/[id]/payments` (write) — body `{ amount, paidAt, method?, reference?, notes? }` → `201 Payment`, `400` if `concept` or `kind="creditnota"`, may flip `status → "betaald"`. `PATCH`/`DELETE .../payments/[paymentId]` — may flip back to `"verzonden"` |
| **J2b.7** | §7 (`credit-note` route) | `POST /api/invoices/[id]/credit-note` (write) — body `{ lines?: { lineId, quantity? }[] }` (omit = full mirror) → `201 Invoice` (`kind: "creditnota"`, `creditNoteOfId`). Reuses J2b.3's finalize endpoint for `series="credit"`. **Server-side validate `quantity <= originalLine.quantity`** for partial credit notes (design doc §12 open risk 5) |
| **J2b.8** | §8.1/§8.2 (UI file list) | `src/app/(app)/facturen/page.tsx` (~140 lines), `facturen/[id]/page.tsx` (~150 lines — at the limit), plus `invoice-status-badge.tsx`, `invoice-line-row.tsx`, `invoice-lines-section.tsx`, `invoice-summary.tsx`, `create-invoice-dialog.tsx`, `invoice-payments-panel.tsx`, `credit-note-dialog.tsx`, `project-invoices-list.tsx`. Sidebar gains `{ href: "/facturen", label: "Facturen", icon: "🧾" }` in `BASE_LINKS` (`sidebar.tsx:22-30`). `project-costs-tab.tsx` (183 lines, already over 150) gains only a button + `project-invoices-list.tsx`, delegated to keep growth minimal |
| **J2b.9** | §8.5 (print) | `facturen/[id]/print/page.tsx` (~130 lines) reusing `PrintLayout` (`print-layout.tsx:40-58`) and `DocumentHeader` (`document-header.tsx:27-109`). Extends `DocumentHeaderProps.meta` (`document-header.tsx:16-25`) with `factuurnummer?`, `factuurdatum?`, `vervaldatum?` — same optional-field shape as the existing `projectnummer`/`accountmanager`/`aangemaaktOp`. Ships its own scoped `<style>` block shaped like `project-costs-tab.tsx:29-49`'s `PRINT_CSS` const; J3 consolidates it later |
| **J2b.10** | §1.4 (settings) + §8.2 | Splits `settings-form.tsx` (163 lines) into `company-settings-fields.tsx` (~90, the 7 existing fields) + `invoice-settings-fields.tsx` (~90, the 6 new fields), leaving `settings-form.tsx` a thin ~50-line wrapper |

**Worked deposit/final example — reproduce exactly as the J2b.5 acceptance fixture** (design doc §4, project "Zomerfestival", `projectId=42`, two periods, `projectCostSummary` → `{ people: 2000, materials: 1500, travel: 200, total: 3700 }`, BTW 21%):

| Document | subtotalExcl | travelExcl | deductionExcl | vatAmount | totalIncl |
|---|---|---|---|---|---|
| Voorschot `2026-0001` (30% of €3 700) | €1 110.00 | €0.00 | €0.00 | €233.10 | **€1 343.10** |
| Eindfactuur `2026-0002` | €3 500.00 | €200.00 | −€1 110.00 | €543.90 | **€3 133.90** |
| Credit note `CN-2026-0001` (−€300 excl. material line) | −€300.00 | €0.00 | €0.00 | −€63.00 | **−€363.00** |

Running "already invoiced" balance for project 42 (excl. VAT): €1 110.00 → €3 700.00 (after final) → €3 400.00 (after the credit note). Cross-check: deposit + final = €3 700 excl./€777.00 VAT/€4 477.00 incl. — exactly `projectCostSummary`'s own figures, confirming the deduction mechanics are exact. **Why the deduction line's `vatRate` must equal the deposit's own frozen 21%, not 0%:** carrying `vatRate=0` on the deduction line would reduce `subtotalExcl`/`deductionExcl` but not `vatAmount`, double-charging VAT on the deposit portion across the two documents (design doc §4.2, verbatim reasoning).

`netInvoicedExcl` — the shared function both J2b.2 (final-role priorDeposits) and J2b.7/K1 (non-double-counting) depend on:
```ts
function netInvoicedExcl(invoice: Invoice): number {
  const own = invoice.subtotalExcl + invoice.travelExcl + invoice.deductionExcl;
  const credited = (invoice.creditNotes ?? [])
    .filter((cn) => cn.status !== "concept")
    .reduce((sum, cn) => sum + cn.subtotalExcl + cn.travelExcl + cn.deductionExcl, 0);
  return own + credited; // credited is already negative
}
```

**Traps:**
- `booking.integration.test.ts` is **not** a template for J2b.3's concurrency test despite the superficial similarity (`PrismaClient` + transaction) — it drives throwaway SQLite (`:3,10`), which serialises every write behind one file lock. A gapless-counter bug and a correct implementation both pass the same SQLite test; only real Postgres exercises the race. Write a new file, `src/lib/invoice-numbering.postgres.test.ts`, guarded to skip with a clear message when `DATABASE_URL` isn't `postgresql://`.
- `GET /api/settings` has no role check today (`settings/route.ts:11-20`) and already leaks `companyIban` to any authenticated user; J2b.10 rides the same endpoint for BTW/bank settings and inherits the same exposure — this is a known, accepted risk (design doc §1.4, §12), not a regression to silently "fix" here (fixing it is phase 1's job and phase 1 is already merged by the time this runs — if it wasn't actually fixed, flag it rather than improvising a change outside this item's scope).
- `settings-form.tsx` (163) and `project-costs-tab.tsx` (183) are **already** over the 150-line limit before this item touches them — J2b.9/J2b.10's edits must shrink them via extraction, not add to the overage.
- `facturen/[id]/page.tsx` is estimated at ~150 lines already (design doc §8.1) — it has zero headroom; plan the extraction (payments panel, lines section, summary are already separate components) before writing it, not after it grows past the limit.
- The regenerate route (`POST /api/invoices/[id]/regenerate`, §7) **discards manual lines** — confirm the UI warns before calling it (design doc §12 open risk 3).

**Verification commands:**
```bash
npx tsc --noEmit && npm run lint && npm test
# J2b.3 only, against compose Postgres:
docker compose up -d db
DATABASE_URL="postgresql://rentflow:rentflow@localhost:5432/rentflow" npx prisma migrate deploy
DATABASE_URL="postgresql://rentflow:rentflow@localhost:5432/rentflow" npx vitest run src/lib/invoice-numbering.postgres.test.ts
```
Success = the Postgres test's resulting `number` set is exactly `{"2026-0001", …, "2026-000N"}` with no duplicates/gaps, and `series="credit"` sequences independently in the same interleaved run; every other commit's `npm test` stays green.

**Definition of done (whole item):**
- [ ] All ten commits land in order on `j2b-invoices`, each individually green (`tsc`/`lint`/`test`)
- [ ] `invoice-lines.ts` never reimplements `pricing.ts`/`grouping.ts` maths — spied/snapshotted in tests, not hand-recomputed
- [ ] Numbering: Postgres concurrency test passes with no duplicates/gaps, both series independent
- [ ] Freezing: the mandatory create→finalize→mutate-project→assert-unchanged test passes
- [ ] Deposit/final worked example reproduced exactly in tests (€1 110/€233.10/€1 343.10 → €2 590 net/€543.90/€3 133.90 → running balance €1 110→€3 700)
- [ ] Credit note arithmetic (−€300/−€63/−€363) and `netInvoicedExcl` non-double-counting both tested
- [ ] Every route opens with `requireModule("Kosten/Facturen", ...)`
- [ ] `facturen/page.tsx`, `facturen/[id]/page.tsx`, `facturen/[id]/print/page.tsx` all render; sidebar link added
- [ ] `settings-form.tsx` and `project-costs-tab.tsx` end this item at or under 150 lines

---

## K1 — Aggregation endpoint

**Branch:** `k1-stats-api` · **after J2b** · **owns the stats contract**

No stats endpoint exists among the 40 route files; no `.aggregate(`/`.groupBy(` anywhere. The dashboard counts client-side over full payloads (`src/app/(app)/page.tsx:41,47,53`). Y1 (phase 0) is a hard dependency — aggregating Decimals-as-strings produces silent nonsense.

**K1.1 — `feat(stats): aggregate business figures`**
- `GET /api/stats?from=&to=` — module **Cijfers: lezen**. Decided response shape (Q27 + Q29 — every revenue figure carries a booked **and** an invoiced value):
  ```ts
  { range: { from: string; to: string },
    revenueByMonth: { month: "2026-06"; bookedPeople: number; bookedMaterials: number;
                      bookedTravel: number; booked: number; invoiced: number }[],
    revenueByClient: { clientId: number; name: string; booked: number; invoiced: number }[],
    personUtilisation: { personId: number; name: string; bookedDays: number; bookedHours: number }[],
    topMaterials: { materialId: number; name: string; code: string | null; revenue: number }[] }
  ```
- Aggregate server-side. Prefer Prisma `groupBy` or month-bucketing in JS over a lean projection — **do not** hand-write date-truncation SQL, which differs between SQLite (dev) and Postgres (prod).
- **Attribution differs between the two series and the page must not imply otherwise:** booked revenue is attributed to the *period*, invoiced revenue to the *invoice's* month. They will not line up.
- **Decided rule for periods spanning a month boundary** (e.g. 2026-05-28 → 2026-06-03): **split the line pro-rata by calendar days in each month.** `periodDays` (`src/lib/pricing.ts:26-35`) only returns a count, so without an explicit rule an implementer would silently bucket everything by `startDate` and put six of seven days' revenue in the wrong month. If pro-rata proves impractical for the invoiced series (an invoice has one date), bucket invoices by invoice date and say so in the UI legend.
- Credit notes must not double-count (J2b.5).
- **Decide and document the N5 scoping answer here** (obligation 3 above).
- Exclude archived materials from `topMaterials` (M1.3's rule).
- **Verify:** every money value is a JSON number (not a string) against **Postgres**; unit tests on the aggregation helpers.

**K1.2 — `test(stats): cover aggregation against seeded data`**
- Assert against DDL-3's seeded volumes: month buckets, client totals, utilisation, and that an invoiced total matches the sum of its invoice lines.

**Files to read before starting:**

| File | Why |
|---|---|
| `src/lib/pricing.ts` (156 lines, full) | `periodDays` (`:26-35`), `projectCostSummary` (`:93-115`) — the only source of the booked figures; K1 must aggregate over these, never re-derive costs inline |
| `src/app/(app)/page.tsx:23,33-57` | Today's client-side counting this endpoint replaces — quoted below |
| `.plans/own-data-scoping-design.md:190-196` | **Already answers the N5 scoping question this item asks you to "decide"** — read it before inventing an answer |
| `.plans/invoice-design.md` §5 (`netInvoicedExcl`, lines 541-547) and §6 | The non-double-counting contract K1's invoiced series must reuse, not reimplement |
| `prisma/schema.prisma` (full) | No `.groupBy(`/`.aggregate(` call exists anywhere in `src/` today (grepped) — you are writing the first one; check the actual `Invoice`/`InvoiceLine` field names against whatever DDL-3 actually landed |

**Current behaviour (verified):**

The dashboard counts client-side over full payloads — no server-side aggregation exists anywhere in the codebase today:
```ts
const projects = projectsQuery.data ?? [];
const upcoming = projects
  .filter((p) => new Date(p.startDate) >= new Date())
  .slice(0, 5);
```
(`src/app/(app)/page.tsx:33-36`, with the three `useQueries` fetches at `:19-31` and the `stats` array built from `.length` at `:38-57`.)

**The N5 scoping question is already decided — do not reopen it.** `.plans/own-data-scoping-design.md:192` states verbatim:
> `GET /api/stats` — **deny entirely for `scope: own`, regardless of matrix**, same reasoning as invoices: aggregate company revenue/utilisation figures have no "my own" reading a freelancer has legitimate use for, and every figure on that page is money-shaped.

K1.1 must implement exactly this (403 for `scope: own`, unconditionally) and record it in the phase 3 exit report per obligation 6 above — "decide" here means "confirm the design doc's answer still holds and wire it", not "choose a new one".

**Traps:**
- `periodDays` (`pricing.ts:26-35`) returns only a whole-period day count, `differenceInCalendarDays(end, start) + 1` — it has no concept of splitting a period across a month boundary. Building the pro-rata split (this brief's own rule) means writing new date-arithmetic in `src/lib/stats.ts` (or similar), not extending `periodDays` itself (which other callers — `personLineCost`, `materialLineCost` — depend on staying a plain day count).
- `BTW_RATE`/`btwAmount`/`withBtw` (`pricing.ts:140-148`) are a **flat 21% constant**, unrelated to the invoice module's per-line `vatRate` (design doc §1, §12 explicitly says the invoice module "never calls these three helpers"). K1 must not import them for the invoiced series either — sum `InvoiceLine.lineTotalExcl`/`vatAmount` as stored.
- `.plans/own-data-scoping-design.md:196` also flags a **second, related dashboard problem for K3**: once N5 denies `GET /api/people`/`GET /api/materials` to `scope: own` (phase 1), the existing dashboard's "Personen"/"Materialen" tiles have no legal data source for a scoped user — check whether phase 1's N5.3 already replaced them before K3 runs; if not, K3 inherits the same gap for its own tiles.
- Credit notes must not double-count (brief's own instruction, line 117 above) — reuse `netInvoicedExcl` (design doc §5) rather than writing a second non-double-counting formula that can drift from J2b's.

**Verification commands:**
```bash
npx tsc --noEmit && npm run lint && npm test
# money-as-number check against Postgres:
docker compose up -d db && DATABASE_URL=postgresql://rentflow:rentflow@localhost:5432/rentflow npx prisma migrate deploy
curl -s "http://localhost:3000/api/stats?from=2026-01-01&to=2026-12-31" | node -e \
  "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); \
   console.log(d.revenueByMonth.every(m=>typeof m.booked==='number'&&typeof m.invoiced==='number'))"
```
Success = the printed check is `true` (no stringified Decimal anywhere in the payload); `K1.2`'s seeded-data assertions pass; a `scope: own` request to `/api/stats` returns 403 regardless of the caller's `Cijfers` matrix level.

**Definition of done:**
- [ ] `GET /api/stats?from=&to=` returns exactly the shape in this brief (lines 106-112 above)
- [ ] Every money value is a JSON number, verified against Postgres
- [ ] Pro-rata month-boundary split implemented and unit-tested (or, if impractical for the invoiced series, invoices bucketed by invoice date with the limitation stated in the UI legend)
- [ ] `scope: own` denied outright per `.plans/own-data-scoping-design.md:192`, recorded in the exit report
- [ ] Credit notes verified not to double-count (shared `netInvoicedExcl`)
- [ ] Archived materials excluded from `topMaterials`
- [ ] `requireModule("Cijfers", "read")` guards the route; N2.5's enumeration test passes with it added

---

## K4 — Material payback `new PO ask`

**Branch:** `k4-payback` · **after K1**

*"A fridge costs us 300, I rent it out at 10, it's rented 30 times — did I pay off the fridge, and what percentage?"* Two top-10 lists: best and worst paid off.

**K4.1 — `feat(stats): compute material payback`**
- New `src/lib/payback.ts`, unit-tested:
  - Earned = `Material.revenueBefore` + flat-booking revenue + **bundle share**.
  - Flat revenue from `PeriodStockItem` snapshots grouped via `stockItem.materialId` — the join is `groupKey` at `src/lib/grouping.ts:34-41`, and the bundle-exclusion filter K4 needs already exists as `materials.filter((m) => !m.bundleBookingId)` inside `groupMaterialAssignmentsNested` (`src/lib/grouping.ts:74`). **Do not reuse the unfiltered `groupMaterialAssignments`** — it would count bundled component lines (at €0) as flat revenue and then add the bundle share on top.
  - Cost basis = sum of per-unit `StockItem.costPrice` where set, else `Material.costPrice` × units owned.
  - `paybackPct = earned / costBasis`; **undefined when no cost price is known → the material is excluded, never shown as 0%**.
  - **Gross rental income only** — the PO dropped the overhead percentage.
- **Bundle attribution (Q48) — the part that is easy to get wrong:**
  - Component lines inside a set are snapshotted at **€0** — verified at `src/lib/booking.ts:153-154` (`dayPriceSnapshot: 0, bundleBookingId: bBooking.id`) — so payback **must not** read component revenue from `PeriodStockItem.dayPriceSnapshot` for bundled lines. It must reconstruct from the bundle booking. `bundleBookingId != null` is the correct discriminator.
  - For each `PeriodBundleBooking`: take `dayPriceSnapshot × quantity × days` and split across the components **pro-rata by the weight snapshotted at booking time** (DDL-3's `PeriodBundleBookingComponent.dayPriceAtBooking × quantity`). **Never use the live `Material.dayPrice`** — that would recompute historical attribution every time a price changes.
  - **No double counting:** flat revenue must exclude `bundleBookingId != null` lines (the `grouping.ts:74` filter) and the bundle share must come only from the bundle bookings. Assert both in one test over a period containing a flat booking and a set booking of the same material.
  - Verified exact against the PO's live data: `Cocktailtafel` €5 + `cocktailtafelhoes` €3 = the €8 set; the buffet set likewise. A €0 component (e.g. "aciet" in `Tap + aciet` €75, where the tap alone is €75) correctly receives nothing.
  - **Edge case:** if every component weight is 0 but the bundle has a price, split equally. Never divide by zero; never silently drop the revenue.
  - Without this, ~52 physical units (15 cocktailtafels + 15 hoezen, 11 buffettafels + 11 hoezen) read €0 forever — exactly the items the PO wants numbers on.
- **Payback ignores the date range** — it is lifetime-to-date by definition.
- **Verify:** cost price 300 + €330 of bookings → 110%; no cost price → absent, not 0%; a cocktailtafel rented only inside the €8 set accrues €5 per rental day; the all-weights-zero fallback; archived materials excluded.

**K4.2 — `feat(stats): expose payback via the stats API`**
- Add a `payback: { best: [...], worst: [...] }` section (or a sibling endpoint — either, but keep one module guard and one contract).

**Files to read before starting:**

| File | Why |
|---|---|
| `src/lib/booking.ts:116-163` (`bookBundleMaterial`) | Proves the €0 snapshot below and where DDL-3's new `PeriodBundleBookingComponent` row is written |
| `src/lib/grouping.ts:34-114` (full) | `groupKey`, `groupMaterialAssignments`, `groupMaterialAssignmentsNested` — the exact filter K4 must reuse |
| `src/lib/pricing.ts:37-91` | `lineCost`/`materialLineCost`/`periodMaterialsCost` — the per-day/per-unit maths the flat-revenue and bundle-share calculations both build on |
| `prisma/schema.prisma` (Material, StockItem, PeriodStockItem, PeriodBundleBooking, MaterialComponent blocks) | Confirm the phase-2 (M1) money/archived fields (`archived`, `costPrice`, `listPrice`, `revenueBefore`) actually landed with these exact names before writing SQL/Prisma against them — **they do not exist in the schema as read for this brief** (grepped, zero hits); phase 2 must have added them by K4's start |
| `.plans/2026-08-po-feedback-round2.md:64` (Q48) | The PO's own verified numeric example — reproduce it in K4.1's test |
| `.plans/tasks-round2/03-phase2.md:49-50,254-255` | Where the M1 money/archived fields are specified, in case K4 needs to check the M1 worker's actual field choices |

**Current behaviour (verified quotes):**

Component lines inside a bundle booking are snapshotted at zero (`src/lib/booking.ts:149-156`):
```ts
      await txClient.periodStockItem.createMany({
        data: chosen.map((stockItemId) => ({
          periodId: args.periodId,
          stockItemId,
          dayPriceSnapshot: 0,
          bundleBookingId: bBooking.id,
        })),
      });
```
The bundle-exclusion filter K4 must reuse already exists (`src/lib/grouping.ts:70-84`, specifically `:74`):
```ts
export function groupMaterialAssignmentsNested(
  materials: PeriodStockItem[],
  bundleBookings: PeriodBundleBooking[],
): NestedCategoryGroup[] {
  const flatItems = materials.filter((m) => !m.bundleBookingId);
```
The **unfiltered** `groupMaterialAssignments` (`grouping.ts:43-68`) has no such filter and will happily group `dayPriceSnapshot: 0` bundled rows alongside real flat bookings — using it for K4's flat-revenue figure would silently zero out (not double-count, but corrupt) the flat total for any material that is both flat-booked and bundle-booked in the same period. **Use `groupMaterialAssignmentsNested`'s `flatItems` filter, or replicate the exact `!m.bundleBookingId` predicate — never the unfiltered function.**

`PeriodBundleBooking` carries one price for the whole set, no per-component breakdown (`prisma/schema.prisma:216-225`):
```prisma
model PeriodBundleBooking {
  id               Int             @id @default(autoincrement())
  periodId         Int
  materialId       Int
  quantity         Int             @default(1)
  dayPriceSnapshot Decimal         @db.Decimal(10, 2)
  ...
}
```
This is exactly why DDL-3's `PeriodBundleBookingComponent` (weight snapshot) must exist before K4 can be written at all.

**Payback formula — precise pseudocode:**
```
function computeMaterialPayback(material, allData):
  # 1. Cost basis — undefined, never 0, when unknown
  perUnitCostPrices = allData.stockItems[material.id]
        .map(s => s.costPrice ?? material.costPrice)
  if material.costPrice == null and every s.costPrice == null:
    return EXCLUDED                      # never displayed as 0%
  costBasis = sum(perUnitCostPrices)      # falls back to material.costPrice per unit where a StockItem has none

  # 2. Flat revenue — bundled lines (bundleBookingId != null) NEVER included
  flatRevenue = 0
  for each period p, for each flat group g in groupMaterialAssignmentsNested(p.materials, p.bundleBookings)
                                          .flatLines matching material.id:
    flatRevenue += materialLineCost(g, periodDays(p)) * g.units   # pricing.ts:52-56, reuse verbatim

  # 3. Bundle share — reconstructed from PeriodBundleBooking, NEVER from
  #    PeriodStockItem.dayPriceSnapshot on bundled lines (always 0, see above)
  bundleRevenue = 0
  for each PeriodBundleBooking b whose bundle contains material.id as a component:
    days              = periodDays(b.period)
    bundleLineTotal   = b.dayPriceSnapshot * b.quantity * days
    componentWeights  = PeriodBundleBookingComponent rows for b   # DDL-3's new table
                          .map(c => c.dayPriceAtBooking * c.quantity)   # NEVER live Material.dayPrice
    totalWeight       = sum(componentWeights)
    thisWeight        = componentWeights[material.id]
    if totalWeight == 0:
      share = bundleLineTotal / componentWeights.length   # all-weights-zero fallback: split equally
    else:
      share = bundleLineTotal * (thisWeight / totalWeight)
    bundleRevenue += share

  earned = (material.revenueBefore ?? 0) + flatRevenue + bundleRevenue
  paybackPct = earned / costBasis
  return { earned, costBasis, paybackPct }
```
No double counting is structural, not a runtime check: step 2 excludes every `bundleBookingId != null` row via the same filter as `grouping.ts:74`; step 3 sources revenue only from `PeriodBundleBooking` rows, which never appear in step 2's iteration. **Assert both directions in one test** — a period containing both a flat booking and a set booking of the same material — per this brief's own instruction above.

**Worked check against the PO's live numbers (Q48, `.plans/2026-08-po-feedback-round2.md:64`):** `Cocktailtafel` day price €5, `cocktailtafelhoes` day price €3, bundle (`cocktailtafel met hoes`) `dayPriceSnapshot` €8. For one unit, one day: `bundleLineTotal = 8`; `componentWeights = {cocktailtafel: 5, hoes: 3}`; `totalWeight = 8`; `cocktailtafel share = 8 × 5/8 = €5`; `hoes share = 8 × 3/8 = €3` — matches exactly, confirming the formula reconstructs reality rather than approximating it. For `Tap + aciet` (€75 total, tap alone also €75, so `aciet`'s own day price is €0): weights `{tap: 75, aciet: 0}`, `totalWeight = 75 ≠ 0`, so the **normal** branch runs (not the zero-fallback) — `aciet share = 75 × 0/75 = €0`, `tap share = 75 × 75/75 = €75`. The equal-split fallback triggers only when **every** component's weight is zero, which is a distinct, rarer case (e.g. a bundle whose components were never given a day price at all).

**Traps:**
- The M1-added fields this formula reads (`Material.archived`, `Material.costPrice`, `Material.listPrice`, `Material.revenueBefore`, `StockItem.costPrice`) are **not present in `prisma/schema.prisma` as read while writing this brief** — confirm they exist, under these exact names, before writing `src/lib/payback.ts`; if M1 named them differently, this brief's pseudocode needs a find-and-replace, not a redesign.
- `PeriodBundleBookingComponent` doesn't exist until DDL-3 ships it (this brief's own addition, not in the design doc's model list) — K4 cannot start meaningfully before DDL-3 lands, matching the dependency graph at the top of this file.
- Archived materials must be excluded (same M1.3 rule K1 already applies to `topMaterials`) — apply it consistently here too, or a decommissioned fridge nobody rents any more keeps cluttering the "worst payback" list forever.
- `paybackPct` is **lifetime-to-date**, ignoring the `from`/`to` range K1 otherwise applies — do not thread the date range into this function; it would silently make "payback" mean something different from the PO's own framing ("did I pay off the fridge", not "this month").

**Verification commands:**
```bash
npx tsc --noEmit && npm run lint
npx vitest run src/lib/payback.test.ts
```
Success = the cocktailtafel-in-a-set-only case reports €5/rental-day (not €0); a material with no cost price anywhere is absent from both lists (not shown at 0%); a material with cost price 300 and €330 of tracked bookings reports 110%; the all-weights-zero fallback splits equally and never divides by zero; archived materials never appear.

**Definition of done:**
- [ ] `src/lib/payback.ts` implements the formula above, unit-tested standalone (no Prisma import — pure function over already-fetched data, matching the codebase's existing lib-vs-route separation)
- [ ] Flat revenue sourced only via the `!bundleBookingId` filter (`grouping.ts:74`'s predicate)
- [ ] Bundle share sourced only from `PeriodBundleBooking` + `PeriodBundleBookingComponent`, weighted by `dayPriceAtBooking`, never live `Material.dayPrice`
- [ ] No-cost-price materials excluded, never shown at 0%
- [ ] All-weights-zero equal-split fallback implemented and tested
- [ ] Archived materials excluded from both ranked lists
- [ ] Q48's cocktailtafel/buffet numbers reproduced exactly in a test
- [ ] `payback` exposed via `/api/stats` (or a sibling route) behind the same `Cijfers` module guard as K1

---

## K2 — Figures page

**Branch:** `k2-figures-page` · **after K1, K4** · skills: **`dataviz` (read before writing any chart code)**, `design`

**K2.1 — `feat(deps): add recharts and a chart wrapper`**
- No chart library is installed (`recharts`/`chart.js`/`d3`/`visx` absent from `package.json`; `chart.js` exists only transitively). No `src/components/ui/chart.tsx`.
- Add `recharts` plus a shadcn-style `src/components/ui/chart.tsx` wrapper. React 19 compatibility is fine on current versions — verified: `recharts@3.10.1` declares peer `react: ^16.8 || ^17 || ^18 || ^19`. Pin the version you install and record it in the commit body. **Note the convention exception:** `src/components/ui/` is normally never edited, but this file *is* the shadcn chart primitive — add it as generated shadcn output and do not hand-modify it afterwards. Say so in the commit body.

**K2.2 — `feat(cijfers): revenue charts with tables`**
- New `/cijfers` page (Q26) with a date-range control. Decided chart mapping: revenue per month → stacked bars (personeel/materiaal/reis) with the invoiced series as a line over them; revenue per client → horizontal bars, top 10 + "overige".
- **Every chart is paired with a table** — the PO asked for "diagrammen **en** tabellen".
- Empty and loading states; readable in light **and** dark; responsive; wide tables scroll in their own container.

**K2.3 — `feat(cijfers): utilisation and top materials`**
- Person utilisation → grouped bars per month; top 10 materials → horizontal bars. Each with its table.

**K2.4 — `feat(cijfers): payback lists`**
- The two ranked lists with progress bars to 100% (K4). ⚠️ **`src/components/ui/progress.tsx` does not exist** — verified absent. Add it as generated shadcn output (like `chart.tsx` in K2.1) rather than hand-rolling a bar, and note the same never-hand-modify rule. Not a chart, and deliberately not the full sortable table (declined by the PO). Keep it visually separate from the range-filtered charts so nobody reads payback as "this month".

**Files to read before starting:**

| File | Why |
|---|---|
| `src/app/(app)/page.tsx` (124 lines, full) | The existing `Card`/`Link` tile pattern (`:64-82`) and `useQueries` fetch pattern (`:19-31`) K2 should match visually |
| `src/components/cost-summary.tsx` (105 lines, full) | `CostSummary`/`PeriodSubtotals` — the existing "figures with a running total" layout pattern, the nearest thing to a KPI block already in the codebase |
| `src/components/project-costs-tab.tsx:101-171` | The existing table pattern (`colgroup`, sticky header row, `overflow-x-auto` wrapper) K2's paired tables should reuse for wide-table scroll behaviour |
| `package.json` | Confirm chart-library absence yourself before assuming K2.1's claim still holds |

**shadcn components available today in `src/components/ui/`** (verified via `ls`, 20 files, alphabetical): `alert-dialog.tsx`, `alert.tsx`, `badge.tsx`, `button.tsx`, `card.tsx`, `command.tsx`, `dialog.tsx`, `dropdown-menu.tsx`, `form.tsx`, `input.tsx`, `label.tsx`, `popover.tsx`, `scroll-area.tsx`, `select.tsx`, `separator.tsx`, `sheet.tsx`, `table.tsx`, `tabs.tsx`, `textarea.tsx`, `tooltip.tsx`.

**Trap — no `progress.tsx` exists.** K2.4's "progress bars to 100%" has no primitive to build on: there is no `progress.tsx` in the list above. Generate it as shadcn output in the same commit (or K2.1, since it's the same "add a missing shadcn primitive" shape as `chart.tsx`) — do not hand-roll a styled `<div>` bar when the project's convention is to generate the shadcn primitive and never hand-edit it afterwards.

**No `recharts`/`chart.js`/`d3`/`visx` in `package.json`** (grepped directly — only `@prisma/adapter-libsql`/`@prisma/adapter-pg` matched under similarly-shaped queries, confirming K2.1's claim that no chart library is installed). Confirm the exact `recharts` version at install time rather than trusting the `3.10.1` figure in this brief to still be current.

**`dataviz` skill guidance to apply** (read the skill in full before writing chart code, per the header instruction on K2 above): its chart-form heuristic maps directly onto this item's already-decided mappings — categorical comparison over time → bars (K2.2's stacked personeel/materiaal/reis bars), a single continuous trend overlaid on categories → line (the invoiced-series overlay), ranked categorical comparison → horizontal bars (K2.2's per-client and K2.3's top-materials charts). Apply its brand-neutral categorical palette (swap in this project's own token colours rather than the skill's placeholder palette) and its light/dark-safe colour formula — this project's existing print/theme convention already forces a light palette under `@media print` (see J3 below), so K2's charts must independently verify readability in both the app's normal light and dark themes, not just print. Follow its interaction rules for tooltips/legends rather than inventing new ones.

**Current behaviour (verified quote — the tile pattern to match):**
```tsx
<Link key={s.label} href={s.href} className="block focus:outline-none focus-visible:ring-2 ...">
  <Card className="hover:bg-accent/50 transition-colors cursor-pointer h-full">
    <CardHeader className="pb-2">
      <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
    </CardHeader>
    <CardContent>
      <div className="text-2xl">{s.icon}</div>
      <div className="text-3xl font-bold">{s.value}</div>
    </CardContent>
  </Card>
</Link>
```
(`src/app/(app)/page.tsx:65-81`.)

**Verification commands:**
```bash
npx tsc --noEmit && npm run lint && npm test
npm run dev   # then visually check /cijfers in both light and dark, and at a narrow viewport
```
Success = every chart has a paired table; empty/loading states render without layout shift; wide tables scroll inside their own container, not the page; payback lists are visually separated from the range-filtered charts.

**Definition of done:**
- [ ] `recharts` + `src/components/ui/chart.tsx` added (generated, version pinned in the commit body), plus `src/components/ui/progress.tsx` if not already added by another item
- [ ] `/cijfers` page with date-range control, revenue-per-month (stacked bars + invoiced line) and revenue-per-client (horizontal bars, top 10 + "overige") — each paired with a table
- [ ] Person utilisation (grouped bars per month) and top 10 materials (horizontal bars) — each paired with a table
- [ ] Payback lists (K4) as progress bars, visually separated from the range-filtered section, no full sortable table
- [ ] `dataviz` skill applied; `design` skill applied; readable in light and dark; responsive; wide tables scroll in their own container

---

## K3 — Dashboard tiles

**Branch:** `k3-dashboard-tiles` · **after K1**

**K3.1 — `feat(dashboard): add headline figures`**
- Two or three money figures beside the existing count cards (`src/app/(app)/page.tsx`, 124 lines — extract if needed), each linking into `/cijfers`. Cards are already `Link`-wrapped (`:65-68`), so follow that pattern.
- Hide the money tiles for roles without `Cijfers: lezen` (use `usePermissions()` from N4.2) — the server already refuses, this is the affordance.
- Remember M1.3: the "Materialen" count must exclude archived.

**Files to read before starting:**

| File | Why |
|---|---|
| `src/app/(app)/page.tsx` (124 lines, full) | The whole file this item extends — quoted in full below |
| `.plans/own-data-scoping-design.md:196` | Flags that this exact page may already need N5.3 changes for `scope: own` users — check before adding to it |
| `src/hooks/` | Where `usePermissions()` (N4.2) should already live by the time this item starts — confirm its exact export name/shape rather than assuming |

**Current behaviour (verified — the file in full is 124 lines, under the limit today):**
```tsx
const [projectsQuery, peopleQuery, materialsQuery] = useQueries({
  queries: [
    { queryKey: ["projects"], queryFn: () => get<Project[]>("/api/projects") },
    { queryKey: ["people"], queryFn: () => get<Person[]>("/api/people") },
    { queryKey: ["materials"], queryFn: () => get<Material[]>("/api/materials") },
  ],
});
```
(`:19-31`.) The three existing count tiles (`:38-57,63-83`) are already `Link`-wrapped, per this brief's own claim — confirmed at `:65-68`:
```tsx
<Link key={s.label} href={s.href} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl">
```

**Traps:**
- Adding 2-3 new money tiles to a 124-line file leaves very little headroom before 150 — plan the extraction (e.g. a `dashboard-stat-tile.tsx` component, since the JSX per tile is already ~15 lines) before writing, not after.
- `.plans/own-data-scoping-design.md:196` recommends that N5.3 (phase 1) already replace the "Personen"/"Materialen" tiles' data source for `scope: own` users, since those two routes (`GET /api/people`, `GET /api/materials`) become denied outright for that scope. **Confirm phase 1 actually made this change before K3 runs** — if the dashboard still fetches those two endpoints unconditionally for a scoped user, K3's new money tiles are being added to a page with a pre-existing, adjacent bug that isn't this item's job to fix but is worth flagging in the exit report if still present.
- `usePermissions()` is an N4.2 (phase 1) hook this brief assumes exists — verify its actual name and return shape (e.g. `hasLevel(module, level)` vs a boolean map) rather than guessing, since N4 is a different phase's worker's design.

**Verification commands:**
```bash
npx tsc --noEmit && npm run lint && npm test
wc -l src/app/\(app\)/page.tsx   # must stay ≤150 after this item
```
Success = the dashboard renders 2-3 new money tiles linking into `/cijfers`, hidden entirely (not just visually disabled) for a role without `Cijfers: lezen`; the file (or its extracted components) stays within the 150-line limit.

**Definition of done:**
- [ ] 2-3 headline money tiles added beside the existing count cards, `Link`-wrapped into `/cijfers` per the existing pattern
- [ ] Tiles hidden (not disabled) for roles without `Cijfers: lezen` via `usePermissions()`
- [ ] "Materialen" count excludes archived (M1.3)
- [ ] `src/app/(app)/page.tsx` (or its extracted parts) ≤150 lines after this item

---

## I1 — Day / week / month switcher

**Branch:** `i1-planning-views` · **after phase 0's Y3.2 split**

`src/app/(app)/planning/page.tsx` was 173 lines and was split in Y3.2. It is a hard-coded week view: `useState(new Date())` cursor (`:42`), `eachDayOfInterval(startOfWeek…endOfWeek, weekStartsOn: 1)` (`:49-52`), fixed `grid grid-cols-7` (`:94`). No `nuqs`; the house URL-state pattern is `useSearchParams()` + `router.replace()` (`src/app/(app)/projects/[id]/page.tsx:34-41`).

**I1.1 — `feat(planning): move the view and date into the URL`**
- `?view=day|week|month&date=YYYY-MM-DD`, replacing the local `useState` cursor. Vorige/Volgende/Vandaag step by the active unit. Shareable and reload-safe.

**I1.2 — `feat(planning): month view`**
- `startOfMonth`/`endOfMonth` with leading/trailing week padding, `weekStartsOn: 1`, `locale: nl` (match `:49-52,110`). Cells show a count that expands on click when a day holds more than fits (Q20).

**I1.3 — `feat(planning): day view as an hour timeline`**
- 08:00–24:00 axis with blocks positioned and sized by actual times (Q20). **This is the payoff surface for H1's per-assignment hours**, which is why I comes after phase 2.
- Decide and handle bookings starting before 08:00 or running past midnight — clamp with an indicator, never silently hide.

**Files to read before starting (in full — both are small):**

| File | Why |
|---|---|
| `src/app/(app)/planning/page.tsx` (173 lines, full) | The whole week-view page I1 rebuilds — quoted in full below |
| `src/components/planning-calendar-item.tsx` (82 lines, full) | The popover-card component I1's day/month views also render |
| `src/app/(app)/projects/[id]/page.tsx:34-41` | The house URL-state pattern (`useSearchParams()` + `router.replace()`) I1.1 must follow — no `nuqs` dependency exists in this codebase |

**Current behaviour — quoted in full for the parts that matter:**

The week cursor is local `useState`, not URL state (`planning/page.tsx:42`):
```ts
const [week, setWeek] = useState(new Date());
```
The week is hard-computed via `eachDayOfInterval`/`startOfWeek`/`endOfWeek` (`:49-52`):
```ts
const days = eachDayOfInterval({
  start: startOfWeek(week, { weekStartsOn: 1 }),
  end: endOfWeek(week, { weekStartsOn: 1 }),
});
```
The grid is a fixed 7-column layout (`:94`):
```tsx
<div className="grid grid-cols-7 gap-2">
```
The grid places whole **projects**, not periods, by comparing the day against the project's overall span (`:54-59`):
```ts
const projectsOnDay = (day: Date) =>
  projects.filter((p) => {
    const dayStart = startOfDay(day);
    const dayEnd = endOfDay(day);
    return new Date(p.startDate) <= dayEnd && new Date(p.endDate) >= dayStart;
  });
```
Dates are always formatted **date-only**, never with a time component, even though `startDate`/`endDate` are full `DateTime`s — three call sites confirm this (`planning/page.tsx:78-79,110`):
```ts
{format(days[0], "d MMM", { locale: nl })} – {format(days[6], "d MMM yyyy", { locale: nl })}
...
{format(day, "EEE d", { locale: nl })}
```
and `planning-calendar-item.tsx:66-67`:
```tsx
{format(new Date(project.startDate), "d MMM yyyy", { locale: nl })}{" "}
– {format(new Date(project.endDate), "d MMM yyyy", { locale: nl })}
```
None of these four call sites ever include an `HH:mm` pattern — this is the concrete evidence behind I2's "times exist in the data but are never formatted" claim, not just a description of it.

**Traps:**
- `planning/page.tsx` is 173 lines today — already over the 150-line limit before I1 touches it. I1.1 (URL state) alone will not shrink it; plan the view-specific extraction (e.g. `planning-week-view.tsx`, `planning-month-view.tsx`, `planning-day-view.tsx`) from the start of I1.2/I1.3, not as an afterthought once the file grows further.
- No `nuqs` or similar URL-state library is a dependency — do not add one; follow `projects/[id]/page.tsx:34-41`'s existing `useSearchParams()`/`router.replace()` pattern instead, per this brief's own instruction.
- `countAssignments` (`planning/page.tsx:31-39`) counts `period.people.length`/`period.materials.length` across **all** of a project's periods — I1.2's month-view "count that expands on click" (Q20) needs a **per-day** count of periods/bookings actually active that day, not this whole-project count; do not reuse `countAssignments` unmodified for the month cells.

**Verification commands:**
```bash
npx tsc --noEmit && npm run lint && npm test
wc -l src/app/\(app\)/planning/page.tsx src/components/planning-calendar-item.tsx
```
Success = `?view=day|week|month&date=YYYY-MM-DD` round-trips through a page reload; Vorige/Volgende/Vandaag step by the active unit; month view shows leading/trailing padding with `weekStartsOn: 1`/`locale: nl` matching the existing week view; day view's hour timeline clamps (with a visible indicator) bookings starting before 08:00 or ending after 24:00, never silently hiding them.

**Definition of done:**
- [ ] `view`/`date` live in the URL, not local `useState`; reload-safe and shareable
- [ ] Month view: leading/trailing padding, `weekStartsOn: 1`, `locale: nl`, expandable count cells (Q20)
- [ ] Day view: 08:00–24:00 hour timeline, blocks sized by actual times, clamped edge cases with an indicator
- [ ] `planning/page.tsx` and any extracted view components ≤150 lines each

---

## I2 — Bucket by period, and show times

**Branch:** `i2-period-bucketing` · **after I1**

The grid places whole **projects** by `project.startDate/endDate` (`planning/page.tsx:54-59`), so it paints days where nothing is booked. Times exist in the data but are never formatted (`:78,79,110`; `planning-calendar-item.tsx:66-67`).

**I2.1 — `feat(api): filter projects by date range`**
- `GET /api/projects` takes **no `NextRequest` at all** today (`src/app/api/projects/route.ts:13`) and returns every project with the full nested tree — a month view multiplies that. Add `?from=&to=` plus a lean `include` for planning, or a dedicated planning endpoint.
- ⚠️ **`from`/`to` must be OPTIONAL with an unfiltered fallback.** Do **not** copy `materials/available/route.ts:20-24` wholesale — that route *requires* the params and 400s without them (`:24`). Three existing callers fetch `/api/projects` with no query string: `src/app/(app)/page.tsx:23` (dashboard stats + upcoming), `src/app/(app)/projects/page.tsx:16` (the projects table), and `src/app/(app)/planning/page.tsx:26` (planning itself, until I2.2 passes a range). Requiring the params breaks all three the moment this commit lands.
- Add a regression test asserting the **no-parameter** response shape is unchanged.

**I2.2 — `feat(planning): place periods, not projects, and show times`**
- Bucket by `Period`; render `HH:mm`.
- **Verify:** a Mon 18:00–23:00 period appears only on Monday with its times; a Mon–Fri project no longer paints days with no period; a month of a year's data loads without fetching every booking line.

**Files to read before starting:**

| File | Why |
|---|---|
| `src/app/api/projects/route.ts` (74 lines, full) | Today's `GET`/`POST` handlers — quoted in full below |
| `src/app/api/materials/available/route.ts` (118 lines, full) | The route this brief explicitly says **not** to copy wholesale for the optional-params trap |
| `src/lib/project-include.ts:3-31` | The current `include` shape `GET /api/projects` always returns — the "lean include for planning" I2.1 needs to trim from |
| `src/app/(app)/page.tsx`, `src/app/(app)/projects/page.tsx`, `src/app/(app)/planning/page.tsx` | The three existing callers — quoted below |

**Current behaviour (verified):**

`GET /api/projects` takes **no `NextRequest` parameter at all** (`src/app/api/projects/route.ts:13-26`):
```ts
export async function GET() {
  const user = await requireAuth().catch(() => null);
  if (!user) return unauthorized();
  try {
    const projects = await prisma.project.findMany({
      orderBy: { startDate: "asc" },
      include: projectInclude,
    });
    return NextResponse.json(projects);
  } catch (err) {
    return serverError((err as Error).message);
  }
}
```
`materials/available/route.ts` **requires** `from`/`to` and 400s without them (`:20-25`):
```ts
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const excludePeriodId = searchParams.get("excludePeriodId");
    const projectId = searchParams.get("projectId");
    if (!from || !to) return badRequest("from en to zijn verplicht");
```
This is the exact pattern I2.1 must **not** copy wholesale for `/api/projects`, per this brief's own warning.

**Every existing caller, confirmed by direct read, all with no query string:**

| Caller | Line | Snippet |
|---|---|---|
| `src/app/(app)/page.tsx` | `:23` | `queryFn: () => get<Project[]>("/api/projects"),` |
| `src/app/(app)/projects/page.tsx` | `:16` | `const res = await fetch("/api/projects");` |
| `src/app/(app)/planning/page.tsx` | `:26` | `const res = await fetch("/api/projects");` |

All three fetch functions treat a non-2xx response identically — `if (!res.ok) throw new Error("Ophalen mislukt")` — so a 400 from a now-mandatory `from`/`to` breaks every one of them the instant this commit lands, exactly as this brief states.

**Traps:**
- `route.ts`'s current `GET` signature is `export async function GET()` — **zero parameters**. Adding `?from=&to=` means changing the signature to `export async function GET(req: NextRequest)` and reading `new URL(req.url).searchParams` — a mechanical change, but every regression test for "no query string" must actually hit the route with **no params at all**, not merely with empty-string params, to catch a signature mistake.
- `project-include.ts:3-31`'s full nested tree (periods → people/materials/bundleBookings, each with their own nested relations) is exactly what "a month view multiplies" — do not just add `from`/`to` filtering to the same `include`; a materially lighter include is also required per this brief's own wording ("a lean `include` for planning, or a dedicated planning endpoint").
- The regression test this brief asks for (**"no-parameter response shape is unchanged"**) must snapshot/assert the **exact same shape** `projectInclude` produces today — if I2.1 swaps in a leaner include for the parametrised path only, verify the *unparametrised* path still returns the original full tree, since `page.tsx`/`projects/page.tsx` still rely on nested `periods`/`people`/`materials` today (e.g. `page.tsx`'s own `countAssignments`-style consumers, and `projects/page.tsx`'s table rendering).

**Verification commands:**
```bash
npx tsc --noEmit && npm run lint
npx vitest run <new-test-file>   # asserting GET /api/projects (no query) shape is byte-identical to before
curl -s "http://localhost:3000/api/projects" | node -e "JSON.parse(require('fs').readFileSync(0,'utf8'))" && echo "no-param path OK"
curl -s "http://localhost:3000/api/projects?from=2026-06-01&to=2026-06-30" | node -e "JSON.parse(require('fs').readFileSync(0,'utf8'))" && echo "ranged path OK"
```
Success = both requests return 200; the unparametrised response is unchanged in shape from before this commit (regression test green); the ranged response is smaller and reflects the trimmed include.

**Definition of done:**
- [ ] `from`/`to` are optional query params with an unfiltered fallback — never a required-params 400
- [ ] Regression test asserts the no-parameter response shape is byte-identical to pre-commit
- [ ] All three existing callers (`page.tsx:23`, `projects/page.tsx:16`, `planning/page.tsx:26`) still work with zero code changes on their side until I2.2 explicitly updates planning's own call
- [ ] A lean include (or dedicated endpoint) exists for the ranged/planning path
- [ ] I2.2: periods (not whole projects) are placed on the grid; times render as `HH:mm`; a month of data loads without fetching every booking line

---

## I3 — Person view

**Branch:** `i3-person-view` · **after I2**

**I3.1 — `feat(planning): toggle between project and person rows`**
- `?mode=project|person` alongside `view`/`date`. One row per person, their bookings across the range, hours from H1.
- Respect N5 scoping: an own-scoped user sees only their own row.
- Reuse I2.1's range-filtered endpoint — do not fetch all projects.

**I3.2 — `feat(planning): flag forced double bookings`**
- Overlapping blocks on a person's row, badged, using `overlapAck` from H2. This is where a deliberate double booking becomes visible at a glance, which was the point of showing it here.

**Files to read before starting:**

| File | Why |
|---|---|
| I2's finished `planning/page.tsx` (post-I2) and its range-filtered endpoint | I3 must reuse this, not fetch all projects separately — confirm what I2 actually shipped before adding `?mode=` |
| `.plans/own-data-scoping-design.md` (own-scoping sections for planning) | I3.1's "respect N5 scoping" instruction — read how N5 scopes `GET /api/projects` for `scope: own` so the person view's own-row filtering composes with it rather than duplicating it |
| H2's `overlapAck` field/flag (wherever phase 2 lands it — check `prisma/schema.prisma` once phase 2 has merged) | I3.2 badges directly off this; confirm its actual field name post-phase-2-merge before writing the badge logic |

**Traps:**
- I3.1 says "reuse I2.1's range-filtered endpoint — do not fetch all projects" — this only works if I2.1's endpoint can also return a **person-centric** shape (or the person view derives it client-side from the same period-level payload I2.2 already fetches). Confirm before starting whether a second query param (`?mode=person`) on the same endpoint, or client-side reshaping of I2's existing response, is the intended path — the brief doesn't specify which, and picking wrong risks a second full-tree fetch exactly like the one I2.1 was built to eliminate.
- An own-scoped user must see only their own row (I3.1) — this is a **client-side row filter on top of a server response that may already be scoped** (per N5), so verify whether the server-side scoping (`own-data-scoping-design.md`) already restricts the payload to the caller's own bookings, in which case the person view's "one row per person" logic would only ever render one row for a scoped user by construction, not because of new client logic — don't build a redundant second scoping check that could silently diverge from the server's.

**Verification commands:**
```bash
npx tsc --noEmit && npm run lint && npm test
```
Success = `?mode=person` shows one row per person with hours from H1; an own-scoped test user sees only their own row; overlapping blocks on a person's row are visibly badged and reflect `overlapAck`.

**Definition of done:**
- [ ] `?mode=project|person` toggle alongside `view`/`date`
- [ ] One row per person, bookings across the range, hours from H1
- [ ] Own-scoped user sees only their own row
- [ ] No duplicate full-tree fetch — reuses I2.1's range-filtered endpoint
- [ ] Overlapping blocks badged using `overlapAck`

---

## J3 — One shared print stylesheet

**Branch:** `j3-print-css` · **after J2b.7**

Two hand-maintained, already-diverged `@media print` blocks exist — `src/components/print/print-layout.tsx:6-34` and `src/components/project-costs-tab.tsx:29-49` — plus a third on the labels page. `src/app/globals.css` has none. J2a and J2b add more documents on top.

**J3.1 — `refactor(print): consolidate print styles`**
- One stylesheet serving pakbon, callsheet, kosten (J2a), invoice (J2b) and labels. Pure refactor: **verify each of the five documents still prints correctly** — print preview each one and say so in the commit body.

**Files to read before starting:**

| File | Why |
|---|---|
| `src/components/print/print-layout.tsx` (58 lines, full) | Block 1 below |
| `src/components/project-costs-tab.tsx` (183 lines, full) | Block 2 below — also already over the 150-line limit, unrelated to this refactor but worth knowing before editing it |
| `src/app/(app)/materials/labels/page.tsx` | Block 3 below |
| `src/app/globals.css` | Confirmed to have **zero** `@media print` rules today (grepped) — this is where the consolidated stylesheet plausibly belongs, or a new shared file imported by all five documents |
| J2b.9's invoice print page (once it exists) | The fourth, newest `@media print` block this item must also fold in |

**All three current `@media print` blocks, verified by direct grep and read:**

**Block 1 — `src/components/print/print-layout.tsx:6-34`** (the shared `PrintLayout` component every other printable page wraps with): sets `@page { size: A4; margin: 1.5cm; }`; hides everything except `.print-root` via `visibility`; forces a fixed light palette by overriding the app's semantic CSS custom properties (`--background`, `--foreground`, `--card`, `--muted`, `--border`, `--secondary`, etc. all pinned to explicit OKLCH light values) inside `.print-paper`; styles `table`/`thead` borders and background; forces `h1,h2,h3` to black.

**Block 2 — `src/components/project-costs-tab.tsx:29-49`** (the Kosten tab's own, independently-written print rules, not reusing Block 1's mechanism even though the component is rendered inside a page that could use `PrintLayout`): sets its own `@page` rule; its own `visibility`-based hide/show scheme keyed off `.print-root`/`.no-print` (same **names**, separately maintained CSS, already diverged in **content** — e.g. this block adds `.cost-period { page-break-inside: avoid }` and `.print-grand-total { border-top: 2px solid #000 }`, which Block 1 has no equivalent of); forces `body { color: #000 !important; font-size: 10pt; }` directly rather than through the CSS-custom-property override Block 1 uses; also defines a `.print-only { display: none; }` / `display: block !important` toggle Block 1 doesn't have at all.

**Block 3 — `src/app/(app)/materials/labels/page.tsx:9-18`** (the labels page's own, third independent scheme): a much smaller block using `.label-sheet` (not `.print-root`) as its visibility root, with no colour-token overrides and no table styling at all — the simplest of the three, and structurally the most different (different visibility-root class name entirely).

**Traps:**
- All three blocks reimplement the same "hide everything, show only the printable root" mechanism via `body * { visibility: hidden }` + a scoped `visibility: visible` override, but under **two different root class names** (`.print-root` in blocks 1–2, `.label-sheet` in block 3) — consolidating means picking one convention and migrating the labels page onto it, not just concatenating the three blocks.
- Block 2 duplicates Block 1's `@page`/`visibility` rules with **subtly different values** (e.g. Block 1 has no `.print-grand-total`/`.cost-period` rules; Block 2 has no CSS-custom-property colour overrides) — a naive merge that just keeps "whichever rule appears last" risks silently dropping one side's rules for a shared selector.
- This item lands **after J2b.7** (credit notes) per its own gate, meaning J2b.9's invoice print page will already exist with its **own**, fourth scoped `<style>` block (per the design doc §8.5: "ships with its own scoped `<style>` block in the same shape as `project-costs-tab.tsx:29-49` … in the meantime, to avoid blocking J2b on J3") — so by the time J3 runs there are **four** blocks to fold in, not three; re-grep `@media print` before starting rather than trusting this brief's count.
- "Pure refactor" per this brief's own instruction — do not change any visual output; the verification is entirely "does it still print the same", which needs an actual print-preview per document, not just a visual diff of the CSS source.

**Verification commands:**
```bash
grep -rn "@media print" src/   # re-confirm the actual count/locations before starting AND before finishing
npx tsc --noEmit && npm run lint && npm test
```
Print-preview each of the five documents in a real browser (`window.print()` → preview, not printing to paper) and record the result in the commit body: pakbon, callsheet, kosten (`project-costs-tab.tsx`), invoice (J2b.9's print page), labels.

**Definition of done:**
- [ ] One consolidated stylesheet (in `globals.css` or a new shared file) serves all five documents
- [ ] All `@media print` blocks found by `grep -rn "@media print" src/` at the start of this item are removed from their original files and replaced by the shared one
- [ ] Each of the five documents individually print-previewed and confirmed unchanged, listed by name in the commit body
- [ ] No visual/behavioural change — pure refactor

---

## Phase 3 exit report

1. Branch + commit list per item.
2. **Invoice numbering evidence:** the concurrency test result showing no duplicates and no gaps.
3. **Freezing evidence:** a sent invoice's totals before and after editing the underlying project.
4. **Payback evidence:** the cocktailtafel case — a component rented only inside a set showing its pro-rata share rather than €0.
5. Confirmation that `/api/stats` and `/api/invoices/*` carry module guards and that N2.5's enumeration test passes.
6. The N5 scoping decision for `Cijfers`, as implemented.
7. Which five print documents were verified after J3.
8. For the PO to check: create an invoice from a project, send it, edit the project, confirm the invoice did not change; open `/cijfers` and confirm the payback lists look plausible against real purchase prices.
