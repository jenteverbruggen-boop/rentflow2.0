# Invoice design — J2b "Real invoices"

> Status: **design doc, for approval**. Blocks `.plans/tasks-round2/04-phase3.md`'s J2b (and, transitively, DDL-3, since DDL-3 must carry this doc's schema). No implementation in this document.
> Source decisions (FINAL, not reopened here): `.plans/2026-08-po-feedback-round2.md` Q23–Q25c (lines 36–41), workstream J (lines 317–357); commit sequence to serve: `.plans/tasks-round2/04-phase3.md:52–86`; conventions: `.plans/tasks-round2/00-README.md`, `CLAUDE.md`, `AGENTS.md`.
> Author's note to the implementing worker: every "Deviation" callout below is a refinement of *how* a decided behaviour is built, not a reversal of a decision. If you find a callout contradicts something a PO explicitly decided, stop and ask — but the decisions table only fixes behaviour and legal shape, not TS union spellings or file layout, and this doc has latitude there by its own brief.

## 0. Recap of what is FINAL (do not relitigate)

1. RentFlow is the invoicing system: numbered invoices, invoice/due dates, status, frozen amounts once sent, credit notes, an overview page.
2. Deposit + final invoicing: a project can carry several invoices; a deposit is fixed-amount OR percentage, chosen per invoice; the final invoice bills everything minus what was already invoiced.
3. Credit notes use a separate, gapless, sequential number series (`CN-2026-0001` vs `2026-0001`).
4. Mark-as-paid supports partial payments; an invoice shows a remaining balance.
5. Lines are grouped per period (sections named after the period).
6. Travel costs sit outside the subtotal, inside the total, BTW over everything.
7. BTW is a configurable setting (default 21%), stored per invoice line.
8. Peppol/UBL is future, out of scope now; the model must be Peppol-shaped (snapshotted client VAT + billing address, per-line unit codes, per-line VAT rate, payment reference, document generation behind an interface).
9. New settings: payment terms, bank account holder name, invoice number format, invoice footer, BTW rate, default deposit percentage.
10. Numbering: gapless, sequential, allocated inside the finalising transaction, never at draft time, never reused; a deleted draft leaves no hole.

---

## 1. Data model

### 1.1 New models — `prisma/schema.prisma` (Postgres, Decimal money)

```prisma
model Invoice {
  id                Int       @id @default(autoincrement())

  // Document identity — never changes after creation
  kind              String    @default("invoice")   // "invoice" | "creditnota" — TS union + zod
  series            String    @default("invoice")   // "invoice" | "credit" — which InvoiceCounter row this draws from

  // Lifecycle — see §3 (freezing) and §6 (status/payments)
  status            String    @default("concept")   // "concept" | "verzonden" | "betaald" — TS union + zod
  invoiceRole       String    @default("standalone") // "deposit" | "final" | "standalone" — meaningless when kind = "creditnota"

  number            String?                          // e.g. "2026-0001" / "CN-2026-0001"; null while concept
  year              Int?                              // year the number was allocated in; null while concept

  projectId         Int?
  clientId          Int
  creditNoteOfId    Int?

  // Peppol-shaped snapshot of client identity (never a live join once frozen — see §3)
  clientName        String
  clientAddress     String?
  clientPostalCode  String?
  clientCity        String?
  clientVatNumber   String?

  invoiceDate       DateTime?
  dueDate           DateTime?
  paymentReference  String?

  currency          String    @default("EUR")

  subtotalExcl      Decimal   @default(0) @db.Decimal(10, 2)  // people + materials + bundle lines
  travelExcl        Decimal   @default(0) @db.Decimal(10, 2)  // travel lines — outside subtotal, inside total
  deductionExcl     Decimal   @default(0) @db.Decimal(10, 2)  // deposit-deduction lines (negative); 0 unless invoiceRole = "final"
  vatAmount         Decimal   @default(0) @db.Decimal(10, 2)  // Σ(line.lineTotalExcl × line.vatRate / 100), never a single flat-rate calc
  totalIncl         Decimal   @default(0) @db.Decimal(10, 2)  // subtotalExcl + travelExcl + deductionExcl + vatAmount

  depositType       String?                                   // "fixed" | "percentage" — only when invoiceRole = "deposit"
  depositPercentage Decimal?  @db.Decimal(5, 2)
  depositBasisExcl  Decimal?  @db.Decimal(10, 2)               // project-total-excl-VAT the % was applied to, frozen at generation

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
  section        String?             // period name (Q24); null for deposit/deduction/manual lines
  kind           String              // "person" | "material" | "bundle" | "travel" | "deduction" | "deposit" | "manual" — TS union + zod
  description    String
  quantity       Decimal  @db.Decimal(10, 2)
  unit           String              // "dag" | "uur" | "stuk" — TS union + zod; Peppol unit-code mapping (DAY/HUR/C62) is a render-time lookup table, added later, not stored now
  unitPrice      Decimal  @db.Decimal(10, 2)
  vatRate        Decimal  @db.Decimal(5, 2)   // percentage, e.g. 21.00 — same convention as the existing `discountPct` (schema.prisma:195,233)
  lineTotalExcl  Decimal  @db.Decimal(10, 2)  // quantity × unitPrice, signed (negative for "deduction")
  sortOrder      Int
  sourceKind     String?             // "person" | "stockItem" | "bundleBooking" | "travelCost" — traceability only, never re-read for arithmetic
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

Plus two relation-only additions to existing models:
- `Client` (schema.prisma:21-33) gains `invoices Invoice[]`.
- `Project` (schema.prisma:74-91) gains `invoices Invoice[]`.

### 1.2 Same models — `prisma/schema.dev.prisma` (SQLite, Float money)

Identical field names, nullability, defaults, indexes and relations; every `Decimal @db.Decimal(x,y)` becomes `Float`, matching the existing convention (compare `schema.prisma:97` `Decimal @db.Decimal(10,2)` vs `schema.dev.prisma:97` `Float` for the same `ProjectMaterialPrice.dayPrice` field):

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

**Deviation flag (read before objecting):** the phase-3 brief's literal wording lists `status ∈ concept|verzonden|betaald|vervallen|creditnota` (`.plans/tasks-round2/04-phase3.md:344`). This design splits that into two orthogonal fields: `kind` (document type: invoice vs credit note — fixed forever) and `status` (workflow: concept → verzonden → betaald — three values only). `vervallen` and `gedeeltelijk betaald` are **never persisted**; they are computed, because they are time-dependent (a row must not need a write every midnight to become "vervallen") and arithmetic (partial payment is a function of `Σpayments` vs `totalIncl`, not a fact to store and risk drifting from the payments table). See §6 for the full derivation and why. This does not change any decided behaviour — every one of the five states in the brief is still reachable and displayable; it changes only which of them live in a column.

### 1.3 `src/types/index.ts` additions

Extends the existing hand-maintained mirror (`src/types/index.ts:1` — no generated types, per its own file-level convention and `CLAUDE.md`'s "All domain types live in `src/types/index.ts`"):

```typescript
export type InvoiceKind = "invoice" | "creditnota";
export type InvoiceStatus = "concept" | "verzonden" | "betaald"; // persisted
export type InvoiceRole = "deposit" | "final" | "standalone";
export type InvoiceLineKind =
  | "person" | "material" | "bundle" | "travel" | "deduction" | "deposit" | "manual";
export type InvoiceLineUnit = "dag" | "uur" | "stuk";
export type DepositType = "fixed" | "percentage";

// Derived-only, never sent as `status` on the wire — see §6
export type InvoiceDisplayStatus =
  | "concept" | "verzonden" | "gedeeltelijk_betaald" | "betaald" | "vervallen" | "creditnota";

export interface InvoiceLine {
  id: number;
  invoiceId: number;
  section: string | null;
  kind: InvoiceLineKind;
  description: string;
  quantity: number;
  unit: InvoiceLineUnit;
  unitPrice: number;
  vatRate: number;
  lineTotalExcl: number;
  sortOrder: number;
  sourceKind: string | null;
  sourceId: number | null;
}

export interface Payment {
  id: number;
  invoiceId: number;
  amount: number;
  paidAt: string;
  method: string | null;
  reference: string | null;
  notes: string | null;
  createdAt: string;
}

export interface Invoice {
  id: number;
  kind: InvoiceKind;
  series: "invoice" | "credit";
  status: InvoiceStatus;
  invoiceRole: InvoiceRole;
  number: string | null;
  year: number | null;
  projectId: number | null;
  clientId: number;
  creditNoteOfId: number | null;
  clientName: string;
  clientAddress: string | null;
  clientPostalCode: string | null;
  clientCity: string | null;
  clientVatNumber: string | null;
  invoiceDate: string | null;
  dueDate: string | null;
  paymentReference: string | null;
  currency: string;
  subtotalExcl: number;
  travelExcl: number;
  deductionExcl: number;
  vatAmount: number;
  totalIncl: number;
  depositType: DepositType | null;
  depositPercentage: number | null;
  depositBasisExcl: number | null;
  notes: string | null;
  footer: string | null;
  createdAt: string;
  finalizedAt: string | null;
  lines: InvoiceLine[];
  payments: Payment[];
  creditNotes?: Invoice[];
  // computed, added by the API, never persisted (see §6):
  displayStatus: InvoiceDisplayStatus;
  remainingBalance: number;
}
```

Zod schemas (co-located next to the route that consumes them, per existing convention — `src/app/api/clients/route.ts:11-21`):

```typescript
const invoiceStatusSchema = z.enum(["concept", "verzonden", "betaald"]);
const invoiceRoleSchema = z.enum(["deposit", "final", "standalone"]);
const depositTypeSchema = z.enum(["fixed", "percentage"]);
const invoiceLineKindSchema = z.enum([
  "person", "material", "bundle", "travel", "deduction", "deposit", "manual",
]);
const invoiceLineUnitSchema = z.enum(["dag", "uur", "stuk"]);
```

### 1.4 Settings additions (`src/lib/settings.ts:3-11`)

Extend `SETTING_KEYS` (currently 7 company keys) with six new keys, per Q25b + the new default-deposit-percentage:

```typescript
const SETTING_KEYS = [
  "companyName", "companyAddress", "companyPostalCode", "companyCity",
  "companyPhone", "companyVat", "companyIban",
  "invoicePaymentTermDays",     // string, integer days, default "30"
  "invoiceBankAccountHolder",   // string
  "invoiceNumberFormat",        // string, default "{year}-{seq:04d}"
  "invoiceFooter",              // string, free text
  "btwRate",                    // string, percentage number, default "21"
  "defaultDepositPercentage",   // string, percentage number, default "30"
] as const;
```

`getSettings`/`setSettings` (`settings.ts:14-38`) need no logic change — they already filter against `SETTING_KEYS` and upsert generically. `PUT /api/settings` (`src/app/api/settings/route.ts:22-32`) needs no change either; it already accepts any patch and lets `setSettings` filter it. `GET /api/settings` (`settings/route.ts:11-20`) is `requireAuth()`-only today (no role check) and already leaks `companyIban`; extending it with bank/BTW settings is the same trust boundary already accepted — **flagged as a risk in §12**, not fixed here (out of this doc's scope; N1's module matrix is the actual fix once phase 1 lands).

---

## 2. Numbering — two gapless, sequential, concurrency-safe series

### 2.1 Mechanism

One `InvoiceCounter` row per `(series, year)`, `series ∈ {"invoice", "credit"}`. A number is allocated **only** inside the transaction that flips `status: "concept" → "verzonden"` (§3), via an atomic upsert-increment, not a read-then-write:

```sql
INSERT INTO "InvoiceCounter" ("series", "year", "lastSeq")
VALUES ($1, $2, 1)
ON CONFLICT ("series", "year")
DO UPDATE SET "lastSeq" = "InvoiceCounter"."lastSeq" + 1
RETURNING "lastSeq";
```

Run via `tx.$queryRaw` inside the same `prisma.$transaction` that also sets `number`, `year`, `invoiceDate`, `dueDate`, `status`, and freezes the row (§3). `year` is `invoiceDate.getFullYear()` at the moment of finalisation (Brussels-local, per the Time rule in `.plans/tasks-round2/00-README.md:54`), not the draft's `createdAt` — a draft opened in December and sent in January gets a January number.

The credit-note series (`series = "credit"`) uses the identical mechanism against the same `InvoiceCounter` table, keyed `("credit", year)` — one counter mechanism, two independent rows, so nothing special is built for the second series.

### 2.2 Why this is safe on Postgres

The `INSERT ... ON CONFLICT ... DO UPDATE ... RETURNING` statement takes an implicit row-level lock on the conflicting `(series, year)` row for the duration of the transaction. Under Postgres's MVCC, a second concurrent transaction attempting the same upsert **blocks** until the first commits or rolls back, then proceeds against the now-incremented row. This is standard atomic-counter practice and is correct at the default `READ COMMITTED` isolation level Prisma uses — no `SERIALIZABLE`, no explicit `SELECT ... FOR UPDATE`, no application-level lock required.

This deliberately does **not** reuse the codebase's existing `pg_advisory_xact_lock` pattern (`src/lib/booking.ts:30-39,37`). That lock exists because bundle-stock booking has a genuine check-then-act race across *multiple* rows (`freeStockItemIds` reads availability across the whole `StockItem`/`PeriodStockItem` table before writing — two concurrent transactions can both compute "5 free" and both try to claim the same 5th unit). Numbering has no such multi-row read: it is a single-row atomic increment, and the UPSERT's own row lock is the entire mechanism. Introducing an advisory lock here would be redundant machinery copied from a different problem shape.

**Format:** `invoiceNumberFormat` (default `"{year}-{seq:04d}"`) is applied to `series = "invoice"` numbers directly. Credit notes are **always** `"CN-" + <same template applied to the credit counter>` — hardcoded, not independently configurable, because Q25b names exactly one "invoice number format" setting, not two. So `year=2026, seq=1` → `"2026-0001"` for an invoice and `"CN-2026-0001"` for a credit note, matching the roadmap's example exactly (`.plans/2026-08-po-feedback-round2.md:37`).

### 2.3 Draft deletion

Drafts never have a `number` (nullable, set only at finalisation). `DELETE /api/invoices/[id]` is only permitted while `status = "concept"` (409 otherwise, §7); such a delete never touches `InvoiceCounter`. There is therefore no "hole" to create in the first place — the counter is advanced exactly once per document that ever leaves `concept`, and never otherwise.

### 2.4 Testing — must run against real Postgres

`.plans/tasks-round2/04-phase3.md:68` already says this explicitly. Reasoning in full: SQLite serialises **every** write against a database process-wide behind a single file lock (or, for the libsql/adapter setup this repo uses, per-connection queuing) — there is only ever one writer active at a time regardless of what the application code does. A concurrency test that fires N parallel finalisations against SQLite will execute them one at a time no matter whether the counter code is a correct atomic upsert or a buggy "read lastSeq, add 1, write it back" — **both implementations pass the same SQLite test**, which is a false green for the buggy one and proves nothing for the correct one.

The codebase's existing `src/lib/booking.integration.test.ts` is **not** a usable template here despite its name: it stubs `DATABASE_URL` to a `file:` path and drives a throwaway SQLite database through `PrismaLibSql` (`booking.integration.test.ts:3,10,38`). It is a perfectly good test of the *application logic* it covers (bundle-sharing correctness), because that suite never asserts anything about concurrent writers — but it cannot be pointed at the numbering race, because SQLite would hide the exact bug this test exists to catch.

**New test file:** `src/lib/invoice-numbering.postgres.test.ts`, modelled on `prisma/seed.ts`'s adapter selection instead (`prisma/seed.ts:8-14` — picks `PrismaPg` when `DATABASE_URL` doesn't start with `file:`; `@prisma/adapter-pg` is already a dependency, confirmed in `package.json`). Setup: `docker compose up -d db` (per `CLAUDE.md`'s migration recipe), point `DATABASE_URL` at it, `npx prisma migrate deploy`, then in the test:

1. Create N (e.g. 20) draft invoices for the same `(series="invoice", year)`.
2. Fire all N finalisations concurrently via `Promise.all` against **one** shared `PrismaClient` connected with `PrismaPg` (not one client per call — the point is to race real Postgres connections, not to race in-process await ordering).
3. Assert all N succeed, and the resulting `number` set is exactly `{"2026-0001", …, "2026-0020"}` — no duplicates, no gaps.
4. Repeat interleaved with `series="credit"` finalisations in the same `Promise.all` batch, and assert the two series' sequences are independent (an invoice finalising between two credit notes does not consume a credit-series slot or vice versa).

Wire a `test:postgres` npm script that only runs this file (`vitest run src/lib/invoice-numbering.postgres.test.ts`) and guard it to skip with a clear message if `DATABASE_URL` is not a `postgresql://` URL, so the default `npm test` (SQLite, per `ci.yml`) does not silently execute zero assertions and call it green. **CI implication (flagged, not solved here):** `ci.yml` today only runs `npm test` against SQLite; getting this concurrency guarantee checked on every PR needs a CI step that starts the compose Postgres and runs `test:postgres` — recommended as a follow-up to `ci.yml`, not part of this design.

---

## 3. Freezing

Freezing is enforced **per the transition**, not per field in isolation — everything below happens atomically inside `POST /api/invoices/[id]/finalize` (§7).

| Transition | What becomes immutable | What is written at this instant |
|---|---|---|
| `concept` created | Nothing yet — a draft is fully mutable. | `clientName`/`clientAddress`/`clientPostalCode`/`clientCity`/`clientVatNumber` are copied from the live `Client` row as an **initial, re-copyable** snapshot (a "refresh client details" action may re-copy them any number of times while still `concept`). |
| `concept → verzonden` (finalisation) | **Everything**: `number`, `year`, `invoiceDate`, `dueDate`, `paymentReference`, every client-snapshot field, `subtotalExcl`/`travelExcl`/`deductionExcl`/`vatAmount`/`totalIncl`, `depositType`/`depositPercentage`/`depositBasisExcl`, and every `InvoiceLine` row in full (no line may be added, edited or removed after this point). | `number`/`year` allocated per §2; `invoiceDate = now()`; `dueDate = invoiceDate + invoicePaymentTermDays`; `paymentReference` generated (structured reference, e.g. a Belgian OGM-VCS checksum reference derived from `number` — exact algorithm is an implementation detail, out of this doc); `status = "verzonden"`; `finalizedAt = now()`. |
| `verzonden → betaald` | Nothing new freezes — all invoice content was already frozen at the prior transition. | Only `status` changes (auto, on a qualifying `Payment`, or via an explicit "markeer betaald" override — §6). `Payment` rows are appended; they are bookkeeping metadata about the invoice, not invoice content, and remain correctable (edit/delete) at any time by an authorised user — a deliberate, explicit exception to "frozen once sent", called out here so it is not read as an oversight. |
| Credit note issued against an invoice | The **original invoice is not touched at all** — no field changes, no status change. A credit note is a wholly separate `Invoice` row (`kind = "creditnota"`, `creditNoteOfId` pointing back). The link is visible only by querying the `creditNotes` relation, never by a written flag on the original. | A brand-new draft `Invoice` row is created (§5), independently finalised (§2) through its own `concept → verzonden` transition on the `credit` series. |

**Enforcement is at the API, not by convention** (`.plans/tasks-round2/04-phase3.md:71` and MUST-COVER §3 both require this explicitly): every route that would mutate `InvoiceLine` rows or `Invoice` totals — `PATCH /api/invoices/[id]`, `POST/PATCH/DELETE /api/invoices/[id]/lines(/[lineId])`, `POST /api/invoices/[id]/regenerate` — opens with a single shared guard, `assertDraftMutable(invoice)` in `src/lib/invoices.ts`, that loads the invoice's current `status` inside the same request and returns `conflict("Factuur is al verzonden — niet meer te wijzigen")` (409, via the existing `conflict()` helper, `src/lib/api-auth.ts:42-44`) whenever `status !== "concept"`. No route is allowed to special-case an exception to this guard.

**What happens when a booking, rate or project changes after an invoice is sent:** nothing, by construction — not because of a check, but because there is nothing to check. `InvoiceLine` stores its own `description`/`quantity`/`unitPrice`/`vatRate`/`lineTotalExcl`, copied once at generation time (§5). It is never a live view over `PeriodPerson`/`PeriodStockItem`/`PeriodBundleBooking` — the optional `sourceKind`/`sourceId` pair exists purely for traceability (e.g. "which booking did this line come from" in an audit screen) and must never be read back into a total or a re-render of the line. This mirrors the existing snapshot convention already used for `dayPriceSnapshot` on `PeriodPerson`/`PeriodStockItem` (`schema.prisma:193,232`), which the codebase already trusts to survive a later live-price change.

**Test requirement (J2b.4, mandatory):** create an invoice from a seeded project, finalise it, then mutate the underlying project — e.g. re-snapshot a person's price via the existing `PATCH .../prices/person/[personId]` re-stamp path (`.plans/2026-08-po-feedback-round2.md:150`) or edit the period's dates — and assert the invoice's `lines` and all five money totals are byte-identical before and after. This is the entity's whole purpose and must be a real regression test, not a manual check.

---

## 4. Deposit/final arithmetic — worked example

Project "Zomerfestival" (`projectId = 42`), two periods, computed via the existing `projectCostSummary`/`periodTotal` machinery (`src/lib/pricing.ts:93-115,117-132`):

| Period | Personen | Materialen | Reiskosten |
|---|---|---|---|
| Opbouw | €400 | €800 | €50 |
| Festivaldagen | €1 600 | €700 | €150 |
| **Totaal** | **€2 000** | **€1 500** | **€200** |

`projectCostSummary(periods)` (`pricing.ts:93-115`) → `{ people: 2000, materials: 1500, travel: 200, total: 3700 }` — `total = people + materials + travel` (`pricing.ts:113`, Q22's "travel outside subtotal, inside total"). BTW setting = 21%.

### 4.1 Voorschotfactuur (deposit), 30% of project total

Created with `invoiceRole = "deposit"`, `depositType = "percentage"`, `depositPercentage = 30`. `depositBasisExcl` is frozen at generation to the project's current excl-VAT total (€3 700 — i.e. `projectCostSummary(periods).total`, not a later, possibly-changed figure). One line only (§5 — deposits don't carry period sections):

| Line | Qty | Unit | Unit price | VAT | Line total excl. |
|---|---|---|---|---|---|
| Voorschot 30% van projecttotaal (project #42 — Zomerfestival) | 1 | stuk | €1 110.00 | 21% | €1 110.00 |

Finalised as **`2026-0001`**, invoiceDate 01/06/2026, dueDate 15/06/2026 (30-day term):

| Field | Value |
|---|---|
| subtotalExcl | €1 110.00 |
| travelExcl | €0.00 |
| deductionExcl | €0.00 |
| vatAmount | €233.10 |
| **totalIncl** | **€1 343.10** |

**Running "already invoiced" balance for project 42 (excl. VAT) = €1 110.00.**

### 4.2 Eindfactuur (final), after the event

Generated with `invoiceRole = "final"` from the real, delivered periods (§5) — **full lines**, grouped per period, exactly as the project's own Kosten tab would show them, **plus** a deduction line for the deposit already invoiced:

| Section | Line | Qty | Unit | Unit price | VAT | Line total excl. |
|---|---|---|---|---|---|---|
| Opbouw | Jan Peeters (opbouw) | 2 | dag | €200.00 | 21% | €400.00 |
| Opbouw | Tent 10×15 ×4 | 4 | stuk | €200.00 | 21% | €800.00 |
| Opbouw | Reiskosten — Jan Peeters | 1 | stuk | €50.00 | 21% | €50.00 |
| Festivaldagen | 4 medewerkers | 4×2 | dag | €200.00 | 21% | €1 600.00 |
| Festivaldagen | Cocktailtafel + hoes ×15 | 15 | stuk | (per-set, see K4 note below) | 21% | €700.00 |
| Festivaldagen | Reiskosten — diverse | — | stuk | — | 21% | €150.00 |
| — | **Reeds gefactureerd: voorschotfactuur 2026-0001 (01/06/2026)** | 1 | stuk | −€1 110.00 | **21%** | **−€1 110.00** |

**Why the deduction line's VAT rate must equal 21%, not 0%:** VAT is due once, on the true delivered amount. The deposit invoice already charged 21% on its €1 110 excl-VAT base. If the eindfactuur's deduction line carried `vatRate = 0`, the deduction would reduce `subtotalExcl`/`deductionExcl` but **not** `vatAmount`, and the eindfactuur's own VAT would be computed on the full €3 700 again — double-charging VAT on the deposit portion across the two documents. Copying the deposit line's own `vatRate` (21%, frozen on the deposit invoice's own line at its own finalisation — not re-read from today's setting) makes the deduction net out VAT exactly as it nets out the excl-VAT amount, so total VAT charged across the deposit + final pair equals VAT on the project's true €3 700, once.

Invoice-level totals (`subtotalExcl` = Σ person/material/bundle lines; `travelExcl` = Σ travel lines; `deductionExcl` = Σ deduction lines; `vatAmount` = Σ over **all** lines of `lineTotalExcl × vatRate/100`), against the project summary table in the section intro (people €2 000 + materials €1 500 = €3 500 subtotal across both periods; travel €200 total; deduction −€1 110):

| Field | Value |
|---|---|
| subtotalExcl | €3 500.00 |
| travelExcl | €200.00 |
| deductionExcl | −€1 110.00 |
| vatAmount | 21% × (3 500 + 200 − 1 110) = 21% × 2 590 = **€543.90** |
| **totalIncl** | 2 590 + 543.90 = **€3 133.90** |

Finalised as **`2026-0002`** (same `invoice` series, next sequence number — the deposit and final invoice share one counter row since both have `series = "invoice"`; only credit notes get their own row).

**Cross-check against the project total:** deposit (€1 110 excl., €233.10 VAT, €1 343.10 incl.) + final (€2 590 excl., €543.90 VAT, €3 133.90 incl.) = **€3 700 excl., €777.00 VAT, €4 477.00 incl. — exactly the project's own `projectCostSummary`/BTW figures**, confirming the deduction mechanics are exact, not approximate.

**Running "already invoiced" balance for project 42 (excl. VAT) after the final invoice = €1 110.00 + €2 590.00 = €3 700.00** (= the full project total, as expected once everything is billed).

### 4.3 Credit note against the final invoice

Client disputes a €300 excl-VAT material line on `2026-0002` (a cancelled tent). PO issues a credit note referencing it:

| Field | Value |
|---|---|
| kind | `creditnota` |
| creditNoteOfId | id of `2026-0002` |
| number | **`CN-2026-0001`** (own `credit` series, independent sequence from `2026-0001`/`2026-0002`) |
| subtotalExcl | **−€300.00** |
| travelExcl | €0.00 |
| vatAmount | **−€63.00** |
| totalIncl | **−€363.00** |

Credit-note amounts are stored **as the true negative figures** (not a positive amount with a "credit" flag read specially by arithmetic elsewhere) — so any `SUM(totalIncl)`/`SUM(subtotalExcl)` over an invoice and its credit notes is directly the net billed amount, with no special-casing by `kind` required at the call site. This is exactly what §6's `netInvoicedExcl()` and K1's stats aggregation rely on to avoid double-counting (`.plans/tasks-round2/04-phase3.md:109`, "Credit notes must not double-count").

**Running "already invoiced" balance for project 42 (excl. VAT) after the credit note = €3 700.00 − €300.00 = €3 400.00** — the true, corrected value the client owes in total, computed as `Σ(subtotalExcl + travelExcl + deductionExcl)` across every non-concept `Invoice` row for the project (deposit + final + credit note), automatically netting because the credit note's contribution is negative.

---

## 5. Line generation from a project

New pure library, **`src/lib/invoice-lines.ts`** (J2b.1 — "a pure library function: project + periods → grouped draft lines … reusing `src/lib/pricing.ts` rather than reimplementing any cost maths", `.plans/tasks-round2/04-phase3.md:60-61`):

```typescript
function generateDraftInvoiceLines(
  periods: Period[],
  opts: {
    invoiceRole: InvoiceRole;
    vatRate: number;                          // from the btwRate setting, at generation time
    depositType?: DepositType;
    depositValue?: number;                    // the % (0-100) or the fixed excl-VAT amount
    priorDeposits?: {                         // only for invoiceRole = "final" — supplied by the caller (J2b.2), not fetched here
      number: string; invoiceDate: string; netExcl: number; vatRate: number;
    }[];
    projectLabel: string;                     // "project #42 — Zomerfestival", for the deposit line's description
  },
): DraftInvoiceLine[]
```

Kept a pure function with no Prisma access (per the brief's "no persistence yet") — the caller (`POST /api/invoices` in J2b.2) is responsible for fetching `periods` (already-included in `projectInclude`, `src/lib/project-include.ts:3-31`) and any `priorDeposits`.

**Role `standalone`/`final` — grouped per period (Q24):** iterate `periods` sorted by `startDate` (same sort as `project-costs-tab.tsx:52-54`), and per period:

- `days = periodDays(period)` (`pricing.ts:26-35`).
- **People:** one `InvoiceLine` per `PeriodPerson`, `kind: "person"`, `section: period.name`, `quantity: days` (or hours, once H5/L5 land — `unit` reflects whichever billing unit the assignment snapshot used), `unitPrice: pp.dayPriceSnapshot`, `lineTotalExcl: personLineCost(pp, days)` (`pricing.ts:58-60`) — **do not** recompute this by hand; call the existing helper, per the Money rule (`.plans/tasks-round2/00-README.md:53`, and the exact bug class this rule exists to prevent: `.plans/2026-08-po-feedback-round2.md:90-95`).
- **Flat materials:** reuse `groupMaterialAssignments(period.materials)` (`src/lib/grouping.ts:43-68`) exactly as `project-costs-tab.tsx:85,150` does; one `InvoiceLine` per `MaterialGroup`, `kind: "material"`, `quantity: group.units`, `unit: "stuk"`, `unitPrice: lineCost(group.dayPriceSnapshot, days, group)` (the per-unit total across the period, discount applied — `pricing.ts:37-50`), `lineTotalExcl: unitPrice × quantity`. If the group's summed `setupCostSnapshot` (`materialLineCost`, `pricing.ts:52-56`) is `> 0`, add a second line "Op-/afbouw — `<material.name>`" (`quantity: 1`, `unitPrice: setup`) rather than folding it into the same unit price, so the invoice's per-unit arithmetic stays exact.
- **Bundle bookings:** one `InvoiceLine` per `PeriodBundleBooking`, `kind: "bundle"`, `quantity: b.quantity`, `unitPrice: b.dayPriceSnapshot × days` (matches the bundle term in `periodMaterialsCost`, `pricing.ts:86-89`).
- **Travel — itemised, per J1:** one `InvoiceLine` per `PersonTravelCost` row (not a rollup), `kind: "travel"`, `section: period.name` (still labelled by period, but excluded from `subtotalExcl` — it feeds `travelExcl` instead, per Q22), `quantity: t.quantity`, `unitPrice: t.unitCost`, description `"Reiskosten — <person.name>[: <label>]"`.
- Every generated line's `vatRate = opts.vatRate` (the current BTW setting) **except** deduction lines (below), and `sortOrder` follows iteration order: period order → people → materials → bundles → travel, within each section.

**Role `deposit`:** ignore `periods` entirely. One line, `kind: "deposit"`, `section: null`, `quantity: 1`, `unit: "stuk"`:
- `depositType = "percentage"`: `unitPrice = depositBasisExcl × depositValue / 100` where `depositBasisExcl = projectCostSummary(periods).total` (`pricing.ts:93-115`, frozen into `Invoice.depositBasisExcl` at creation).
- `depositType = "fixed"`: `unitPrice = depositValue` directly (entered **excl. VAT**, for consistency with every other excl-VAT-first price in the system).
- description: `"Voorschot <value>% van projecttotaal (<projectLabel>)"` or `"Voorschot (<projectLabel>)"` for the fixed case.

**Role `final` only — deduction lines:** after generating the full standalone-equivalent set of lines above, append one `kind: "deduction"` line **per** entry in `opts.priorDeposits` (there can be more than one, e.g. two partial deposits): `quantity: 1`, `unitPrice: -entry.netExcl`, `vatRate: entry.vatRate` (copied from that deposit's **own** frozen line rate, per §4.2's reasoning — never today's setting), description `"Reeds gefactureerd: voorschotfactuur <entry.number> (<entry.invoiceDate>)"`.

`entry.netExcl` is **not** simply the deposit's original `subtotalExcl` — it must be the deposit's **net** contribution after any credit notes issued against that specific deposit (rare, but must be handled: a refunded/cancelled deposit). Defined once, reused by both this generator's caller and §6:

```typescript
function netInvoicedExcl(invoice: Invoice): number {
  const own = invoice.subtotalExcl + invoice.travelExcl + invoice.deductionExcl;
  const credited = (invoice.creditNotes ?? [])
    .filter((cn) => cn.status !== "concept")
    .reduce((sum, cn) => sum + cn.subtotalExcl + cn.travelExcl + cn.deductionExcl, 0);
  return own + credited; // credited is already negative
}
```

Project-level "already invoiced" balance (§4, and surfaced on the project's Kosten tab per §8) = `Σ netInvoicedExcl(inv)` over every non-concept `Invoice` for that project, of any `kind` (a credit note's negative `netInvoicedExcl` nets itself in automatically, since a `creditnota` has no `creditNotes` of its own to recurse into).

---

## 6. Payments and status

### 6.1 Balance

```typescript
function remainingBalance(invoice: Invoice, linkedCreditNotes: Invoice[], payments: Payment[]): number {
  const effectiveOwed = invoice.totalIncl
    + linkedCreditNotes.filter((cn) => cn.status !== "concept")
        .reduce((s, cn) => s + cn.totalIncl, 0); // already negative
  const paid = payments.reduce((s, p) => s + p.amount, 0);
  return effectiveOwed - paid; // may go negative on overpayment — surface it, never clamp to 0 silently
}
```

### 6.2 Status derivation — persisted vs computed

Persisted `status` (`concept | verzonden | betaald`) reflects explicit workflow actions only: draft creation, finalisation, and a payment (or a "markeer betaald" override) crossing the owed amount. It is auto-flipped:

- **`verzonden → betaald`:** happens automatically, inside the same transaction as `POST /api/invoices/[id]/payments`, whenever the resulting `remainingBalance <= 0`.
- **`betaald → verzonden`:** happens automatically, inside the same transaction as editing/deleting a `Payment`, whenever the resulting `remainingBalance > 0` again (deliberate — correcting a mis-entered payment must not leave a "betaald" invoice with money still owed).
- Credit notes (`kind = "creditnota"`) never receive a `Payment` and never carry `status = "betaald"` — `POST /api/invoices/[id]/payments` rejects with `badRequest` if the target's `kind !== "invoice"`.

`gedeeltelijk_betaald` and `vervallen` are **never** written; they are derived at read time by `resolveInvoiceDisplayStatus` (new, `src/lib/invoice-status.ts`), with this priority order (first match wins — both conditions can be true simultaneously, e.g. an overdue invoice with a partial payment, and the design picks one label per the table below):

| Priority | Condition | Displayed as |
|---|---|---|
| 1 | `kind === "creditnota"` | `creditnota` |
| 2 | `status === "concept"` | `concept` |
| 3 | `status === "betaald"` | `betaald` |
| 4 | `status === "verzonden"` and `dueDate < now` and `remainingBalance > 0` | **`vervallen`** |
| 5 | `status === "verzonden"` and `remainingBalance < effectiveOwed` (some but not all paid) | `gedeeltelijk_betaald` |
| 6 | otherwise | `verzonden` |

**"`vervallen` is derived from"** (MUST-COVER §6, answered explicitly): `status === "verzonden"` (never left concept and never fully paid) **and** `dueDate` has passed **and** a positive balance remains. It is computed fresh on every read (list, detail, stats) from `dueDate`, `totalIncl`, linked credit notes and `payments` — never stored, so it can never go stale relative to "today".

An overdue-**and**-partially-paid invoice displays as `vervallen` (priority 4 over 5) — the PO needs to see which overdue invoices still have money outstanding at a glance; the partial-payment fact remains visible via the `remainingBalance` figure shown alongside the badge, not lost.

`GET /api/invoices` and `GET /api/invoices/[id]` compute `displayStatus` and `remainingBalance` server-side and include them on every returned `Invoice` (§1.3) — these are the two fields added to the wire type beyond what is persisted. Filtering the overview list by status (`?status=vervallen`) is applied **after** this computation, in the route handler, not as a SQL `WHERE` on a stored column (invoice volumes here are modest — tens to low hundreds — so computing in JS after a bounded fetch is the pragmatic choice; do not hand-write a SQL predicate for "overdue" that duplicates this logic and drifts from it).

---

## 7. API routes

All routes below live under `src/app/api/invoices/`, follow the `Promise<{ id: string }>` params convention (`CLAUDE.md` Next.js 16 section; example at `src/app/api/projects/[id]/route.ts:12,19`), and every handler opens with `requireModule("kosten_facturen", <level>)` once N1/N2 land (phase 1, before this phase runs) — the same position `requireAuth()`/`requireRole()` occupy today (`src/app/api/settings/route.ts:12,23`). Verb → level mapping is fixed by N2's own rule: `GET → lezen, POST/PUT/PATCH → wijzigen, DELETE → verwijderen` (`.plans/2026-08-po-feedback-round2.md:557`). "Kosten/Facturen" is already the module the roadmap assigns to invoice routes (`.plans/2026-08-po-feedback-round2.md:545`).

| Method & path | Level | Request | Response |
|---|---|---|---|
| `POST /api/invoices` | write | `{ projectId: number; invoiceRole: InvoiceRole; depositType?: DepositType; depositValue?: number }` | `201 Invoice` (with generated `lines`, `status: "concept"`, `number: null`) |
| `GET /api/invoices` | read | query: `?status=&clientId=&projectId=&kind=` (all optional) | `200 Invoice[]` (summary fields + `displayStatus`, `remainingBalance`) |
| `GET /api/invoices/[id]` | read | — | `200 Invoice` (full, with `lines`, `payments`, `creditNotes`) |
| `PATCH /api/invoices/[id]` | write | `{ notes?; footer?; dueDate? }` — concept only | `200 Invoice`; `409` if not concept |
| `POST /api/invoices/[id]/lines` | write | `{ description, quantity, unit, unitPrice, vatRate?, section? }` (manual line) — concept only | `201 InvoiceLine`; `409` if not concept |
| `PATCH /api/invoices/[id]/lines/[lineId]` | write | partial `InvoiceLine` fields — concept only | `200 InvoiceLine`; `409` if not concept |
| `DELETE /api/invoices/[id]/lines/[lineId]` | write | — concept only | `204`; `409` if not concept |
| `POST /api/invoices/[id]/regenerate` | write | — concept only; re-runs §5's generator against the live project, discarding all current generated lines (manual lines are lost too — UI must confirm) | `200 Invoice` |
| `POST /api/invoices/[id]/finalize` | write | `{}` | `200 Invoice` (now `verzonden`, numbered, frozen); `409` if already non-concept |
| `DELETE /api/invoices/[id]` | delete | — concept only | `204`; `409` if not concept ("sent invoices are never deleted, only credited") |
| `POST /api/invoices/[id]/credit-note` | write | `{ lines?: { lineId: number; quantity?: number }[] }` — omit for a full mirror credit note, provide for a partial one | `201 Invoice` (new draft, `kind: "creditnota"`, `creditNoteOfId: id`) |
| `POST /api/invoices/[id]/payments` | write | `{ amount, paidAt, method?, reference?, notes? }` | `201 Payment`; `400` if invoice is `concept` or `kind = "creditnota"`; may flip `status → "betaald"` |
| `PATCH /api/invoices/[id]/payments/[paymentId]` | write | partial `Payment` fields | `200 Payment`; may flip `status → "verzonden"` |
| `DELETE /api/invoices/[id]/payments/[paymentId]` | delete | — | `204`; may flip `status → "verzonden"` |

Note the credit-note route creates a **draft** credit note (`status: "concept"`) rather than an already-final document — it then goes through the exact same `POST .../finalize` endpoint as any invoice (§2), just resolving `series = "credit"` because `kind = "creditnota"`. This reuses one finalisation code path for both series instead of building a second one, and lets the PO review a credit note before it is numbered, same as any other invoice.

There is deliberately no server-rendered PDF/print API route — this codebase has no PDF-generation dependency at all (confirmed: no `pdf`/`puppeteer`/`pdfkit`/`xlsx` in `package.json`), and every existing printable document (pakbon, callsheet, kosten) is a client page using `window.print()` via `PrintLayout` (`src/components/print/print-layout.tsx:40-58`), not a generated file. The invoice document follows the same pattern — see §8.

---

## 8. UI

### 8.1 New files (estimated lines, 150-line limit per file)

| File | Est. lines | Purpose |
|---|---|---|
| `src/lib/invoice-lines.ts` | ~120 | §5's pure line generator (lib, not UI) |
| `src/lib/invoice-status.ts` | ~60 | `resolveInvoiceDisplayStatus`, `remainingBalance`, `netInvoicedExcl` (§6) |
| `src/lib/invoice-numbering.ts` | ~50 | Atomic-counter upsert + `invoiceNumberFormat` template substitution (§2), server-only |
| `src/components/invoice-status-badge.tsx` | ~40 | Renders `InvoiceDisplayStatus` as a coloured `Badge` (shadcn) |
| `src/components/invoice-line-row.tsx` | ~90 | One `InvoiceLine` row; `editable` prop toggles inline edit/remove controls — mirrors how `PersonCostRow`/`MaterialGroupCostRow` already embed interactive popovers directly in a row component (`src/components/cost-line-row.tsx:24-63,65-115`) |
| `src/components/invoice-lines-section.tsx` | ~80 | One period "section" heading + its rows (people/materials/bundles), used both on screen and in print |
| `src/components/invoice-summary.tsx` | ~90 | Subtotal/travel/deduction/VAT-per-rate/total block — the invoice-level equivalent of `CostSummary` (`src/components/cost-summary.tsx:58-105`), extended with a deduction row and **one VAT line per distinct rate present** (J2b.7's "VAT summary per rate") rather than one flat `BTW_RATE` line |
| `src/components/create-invoice-dialog.tsx` | ~130 | Role picker (deposit/final/standalone) + deposit type/value fields; `Dialog` + `Form` (shadcn); POSTs `/api/invoices`, redirects to the new invoice's detail page |
| `src/components/invoice-payments-panel.tsx` | ~110 | Payments table + "registreer betaling" form + `remainingBalance` display |
| `src/components/credit-note-dialog.tsx` | ~90 | Full-vs-partial line selection; POSTs `/api/invoices/[id]/credit-note` |
| `src/components/project-invoices-list.tsx` | ~60 | Mini-list of a project's own invoices (number, status badge, total, link) — extracted so `project-costs-tab.tsx` doesn't grow past 150 again |
| `src/components/company-settings-fields.tsx` | ~90 | Extracted from `settings-form.tsx` — the existing 7 company fields |
| `src/components/invoice-settings-fields.tsx` | ~90 | New — the 6 fields from §1.4 |
| `src/app/(app)/facturen/page.tsx` | ~140 | Overview: status/client filters, table, links to detail |
| `src/app/(app)/facturen/[id]/page.tsx` | ~150 | Detail/edit: header, editable `invoice-lines-section` (concept only), `invoice-summary`, `invoice-payments-panel`, status actions (finaliseren / credit note / verwijderen), link to print |
| `src/app/(app)/facturen/[id]/print/page.tsx` | ~130 | `PrintLayout` + `DocumentHeader` + read-only `invoice-lines-section` + `invoice-summary` + payment-terms/IBAN-holder/footer block |

### 8.2 Edits to existing files

- `src/components/document-header.tsx` (109 lines → ~119): extend `DocumentHeaderProps.meta` (`document-header.tsx:16-25`) with three more optional fields — `factuurnummer?: string`, `factuurdatum?: string`, `vervaldatum?: string` — following the file's existing pattern of optional, document-specific meta fields (`projectnummer`, `accountmanager`, `aangemaaktOp` are already exactly this shape). Do **not** add invoice-only fields (payment terms, footer, bank holder) into the shared company block (`document-header.tsx:38-73`) — those render in the invoice print page itself, below the summary, since they don't apply to pakbon/callsheet/kosten.
- `src/components/project-costs-tab.tsx` (183 lines, already over limit — Y3 must split it first per `.plans/2026-08-po-feedback-round2.md:192,664`; J2b's own edit must not re-grow it past 150): add a "Nieuwe factuur" button (opens `create-invoice-dialog.tsx`) and render `project-invoices-list.tsx` — both delegated to their own components so this file's net line growth stays minimal.
- `src/components/settings-form.tsx` (163 lines, already over limit): split into `company-settings-fields.tsx` + `invoice-settings-fields.tsx` (above), leaving `settings-form.tsx` itself as a thin ~50-line wrapper (one `useQuery`, one `useMutation`, two `<FormField>` groups, one submit button) — same shape as today (`settings-form.tsx:31-163`) but delegating the field markup.
- `src/components/sidebar.tsx`: add `{ href: "/facturen", label: "Facturen", icon: "🧾" }` to `BASE_LINKS` (`sidebar.tsx:22-30`) — gated by the module registry once N4 lands; until then it is visible to every authenticated user, same as every other `BASE_LINKS` entry today.

### 8.3 shadcn/ui components used

`Dialog`, `Table`, `Badge`, `Card`, `Form`/`FormField`/`FormControl`/`FormLabel`, `Input`, `Select`, `Separator`, `Button` — all already in `src/components/ui/` (never edited directly, per convention).

### 8.4 TanStack Query keys

| Key | Used by |
|---|---|
| `["invoices", { status, clientId, projectId }]` | `facturen/page.tsx` list |
| `["invoice", id]` | `facturen/[id]/page.tsx`, `facturen/[id]/print/page.tsx` — full invoice incl. `lines`/`payments`/`creditNotes`, invalidated by every mutation below |
| `["settings"]` | existing key (`settings-form.tsx:34`), reused as-is for the new invoice settings fields |
| `["project", id]` | existing key (`projects/[id]/page.tsx:45`), invalidated after invoice creation/finalisation so `project-invoices-list.tsx`'s "already invoiced" figure refreshes |

No separate query key for payments — they are embedded in the `["invoice", id]` response and that key is invalidated on every payment mutation, matching the existing pattern of nested data living under one project-level key (`projects/[id]/page.tsx:45` already nests periods/people/materials under `["project", id]`).

### 8.5 Print document

`facturen/[id]/print/page.tsx` follows the exact structure `callsheet/page.tsx` and `project-costs-tab.tsx`'s print mode already establish: `PrintLayout` (`print-layout.tsx:40-58`) wraps the page for the shared "Afdrukken"/"Terug" chrome and the forced-light-theme print rules; `DocumentHeader` (`document-header.tsx:27-109`, extended per §8.2) renders the company block plus the invoice's own meta (`factuurnummer`, `factuurdatum`, `vervaldatum`, `opdrachtgever` = `clientName`); the body renders `invoice-lines-section` per section (read-only) then `invoice-summary`; below that, a plain block for payment terms, `companyIban` + the new `invoiceBankAccountHolder`, `paymentReference`, and `invoiceFooter`. J3 (`.plans/tasks-round2/04-phase3.md:228-236`) later folds this page's print rules into the one shared stylesheet alongside pakbon/callsheet/kosten/labels — this doc's page ships with its own scoped `<style>` block in the same shape as `project-costs-tab.tsx:29-49` in the meantime, to avoid blocking J2b on J3.

---

## 9. Migration + seed

Per `CLAUDE.md`'s Postgres migration recipe (no local shadow DB):

```bash
docker compose up -d db
npx prisma migrate diff \
  --from-migrations prisma/migrations \
  --to-schema-datamodel prisma/schema.prisma \
  --shadow-database-url "postgresql://rentflow:rentflow@localhost:5432/rentflow" \
  --script > prisma/migrations/$(date +%Y%m%d%H%M%S)_invoices/migration.sql
docker compose run --rm app sh -c "npx prisma migrate deploy"
```

**This migration must include `Invoice`, `InvoiceLine`, `Payment`, and `InvoiceCounter`** — flagged prominently because the current DDL-3 brief (`.plans/tasks-round2/04-phase3.md:31-48`) names only `Invoice` and `InvoiceLine` plus the unrelated `PeriodBundleBookingComponent` (for K4). **`Payment` and `InvoiceCounter` are missing from that brief's text and must be added to it** — J2b's own commits (J2b.1–J2b.9, §11) never touch the schema, since DDL-3 is the phase's only schema-changing commit (`.plans/tasks-round2/00-README.md:61`); if `Payment`/`InvoiceCounter` aren't in DDL-3's migration, J2b.6 (payments, §11) has nothing to build against.

Dev DB: `npm run db:dev:migrate` (schema-driven `prisma db push`, no migration file) against `prisma/schema.dev.prisma`.

**`prisma/seed.ts` additions** (DDL-3 owns `seed.ts`, per `.plans/2026-08-po-feedback-round2.md:670`): the six new settings keys (§1.4) with sensible defaults (`invoicePaymentTermDays: "30"`, `btwRate: "21"`, `defaultDepositPercentage: "30"`, plus placeholder `invoiceBankAccountHolder`/`invoiceNumberFormat`/`invoiceFooter` strings); and, on a couple of the extended seed's ~20 projects (`.plans/tasks-round2/04-phase3.md:46`), a representative spread of invoices exercising every status/kind combination the UI and stats need to render sensibly against real data:

- one `concept` draft (never finalised),
- one `verzonden`, not yet due,
- one `verzonden` past its `dueDate` with no payments (→ displays `vervallen`),
- one `verzonden` with a partial `Payment` (→ displays `gedeeltelijk_betaald`),
- one `betaald` (fully paid),
- one deposit + final pair on the same project (reproducing §4's numbers, or close to them, so a manual PO check against real seed data is possible),
- one `creditnota` linked to a `betaald` or `verzonden` invoice, so K1's stats non-double-counting is exercisable against seeded data (`.plans/tasks-round2/04-phase3.md:114-115`, K1.2's test).

---

## 10. Test plan

| Test file | Covers |
|---|---|
| `src/lib/invoice-lines.test.ts` | §5's generator against a seeded project: correct per-period grouping, travel lines excluded from `subtotalExcl` but present in `travelExcl`, every cost figure produced via `pricing.ts` calls (assert by spying/snapshotting — not by reimplementing the maths in the test), deposit-role single-line shape (both `fixed` and `percentage`), final-role deduction-line generation from a `priorDeposits` fixture matching §4.2's numbers exactly |
| `src/lib/invoice-numbering.postgres.test.ts` | §2.4 in full: N concurrent finalisations, both series, no duplicates/gaps, interleaved series independence. **Postgres only** — guarded/skipped otherwise |
| `src/lib/invoice-status.test.ts` | `resolveInvoiceDisplayStatus`'s full priority table (§6.2), `remainingBalance` arithmetic including a linked credit note, the auto-flip both directions (payment completes → `betaald`; payment corrected downward → back to `verzonden`) |
| Freezing (API-level, e.g. `src/app/api/invoices/[id]/finalize/route.test.ts` or an integration test alongside `booking.integration.test.ts`'s style) | Create → finalize → mutate the underlying project/booking/rate → assert the invoice's `lines` and all five totals are byte-identical (§3's mandatory test) |
| Deposit + final arithmetic | Reproduce §4's worked example exactly: deposit 30% → €1 110.00/€233.10/€1 343.10; final → €2 590.00 net excl./€543.90 VAT/€3 133.90 incl.; credit note → −€300.00/−€63.00/−€363.00; running balance sequence €1 110 → €3 700 → €3 400 |
| Partial payments | Two payments crossing the `betaald` threshold in sequence; a third "overpayment" scenario asserting `remainingBalance` goes negative and is surfaced, not clamped |
| Travel outside subtotal (invoice level) | A generated invoice's `subtotalExcl` excludes travel; `totalIncl` includes it; complements J1's existing `pricing.ts`-level test (which is being rewritten per `.plans/2026-08-po-feedback-round2.md:326`, not this new test) |
| Credit note / stats non-double-counting | Seed a project with deposit + final + credit note; call K1's aggregation helper (or `/api/stats` once it exists) and assert the invoiced figure for that project/month equals the net (`Σ netInvoicedExcl`), not the gross sum of all `Invoice` rows — this is the concrete check `.plans/tasks-round2/04-phase3.md:109` asks for |

---

## 11. Implementation order — mapped onto J2b.1–J2b.8, with proposed additions

The existing 8-commit sequence (`.plans/tasks-round2/04-phase3.md:60-86`) does not mention `Payment` at all despite "mark-as-paid with partial payments" being explicitly in scope for this doc. **Proposed: insert one new commit** (payments), pushing the rest down by one — 9 commits total instead of 8.

| Original ID | New ID | Commit | Notes |
|---|---|---|---|
| J2b.1 | **J2b.1** | `feat(invoices): generate draft invoice lines from a project` | `src/lib/invoice-lines.ts` per §5, including the deposit line and final-role deduction-line shapes (deduction takes `priorDeposits` as an explicit parameter — no DB access yet, per the brief's "no persistence"). Unit-tested per §10 |
| J2b.2 | **J2b.2** | `feat(invoices): create and store draft invoices` | `POST/GET /api/invoices`, `GET /api/invoices/[id]` (§7). Wires §5's generator: resolves `depositBasisExcl` via `projectCostSummary` (`pricing.ts:93-115`); for `invoiceRole: "final"`, fetches this project's prior non-concept `invoiceRole: "deposit"` invoices and their linked credit notes, computes `netInvoicedExcl` per invoice (§5), passes them as `priorDeposits` |
| J2b.3 | **J2b.3** | `feat(invoices): allocate gapless sequential numbers on finalisation` | §2 in full — both series wired from this commit even though credit notes don't exist until J2b.5, so `finalizeInvoice()` is series-agnostic from day one and J2b.5 needs no rework of it. Postgres-only concurrency test per §2.4/§10 |
| J2b.4 | **J2b.4** | `feat(invoices): freeze a sent invoice` | `assertDraftMutable` guard (§3) applied to every line/total-mutating route added so far. Mandatory freezing regression test (§3, §10) |
| J2b.5 | **J2b.5** | `feat(invoices): credit notes` | `POST /api/invoices/[id]/credit-note` (§7); reuses J2b.3's finalize endpoint for the `credit` series; `netInvoicedExcl` (§5) is the shared contract K1 later relies on for non-double-counting |
| — | **J2b.6 (new)** | `feat(invoices): payment records and partial-payment status` | `src/lib/invoice-status.ts` (§6); `POST/PATCH/DELETE /api/invoices/[id]/payments(/[paymentId])` (§7); auto-flip both directions. This is the concrete home for "mark-as-paid WITH partial payments" — absent from the original sequence entirely |
| J2b.6 | **J2b.7** | `feat(invoices): overview page` | `facturen/page.tsx`, `facturen/[id]/page.tsx` and their component set (§8.1); now also renders `invoice-payments-panel.tsx` (needs J2b.6 to exist first, hence the reorder) and `invoice-status-badge.tsx` |
| J2b.7 | **J2b.8** | `feat(invoices): printable invoice document` | `facturen/[id]/print/page.tsx` + `document-header.tsx` extension (§8.2, §8.5) |
| J2b.8 | **J2b.9** | `feat(settings): invoice settings` | `company-settings-fields.tsx` + `invoice-settings-fields.tsx` split (§8.2), six new setting keys (§1.4) |

**DDL-3 correction required** (flagged again, per §9): its brief must be read as covering `Invoice`, `InvoiceLine`, `Payment`, and `InvoiceCounter` — not only the two models its current text names — since J2b's own commits never touch the schema.

---

## 12. Out of scope, and open risks

**Out of scope (explicit, per the roadmap and this doc):**
- Peppol/UBL emission, access-point integration, delivery tracking (Q25c) — the model is shaped for it (client VAT + address snapshot, per-line unit + VAT rate, payment reference, `sourceKind`/`sourceId` traceability) but no XML emitter, no connection, is built now. "Document generation behind a small interface" (per the roadmap) means: keep the print-page's data assembly (client snapshot + grouped lines + totals) as a plain function separate from the React rendering, so a future UBL emitter can consume the same assembled data without touching the routes — no interface/class is introduced in this phase beyond that separation.
- Payment reconciliation with a bank feed, recurring invoices, multi-currency, dunning/reminders — none requested.
- A configurable credit-note number format — hardcoded `CN-` prefix (§2.2), since Q25b named one format setting, not two.
- Fixing `GET /api/settings`'s existing lack of a role/module check (`settings/route.ts:11-20`) — this doc's new bank/BTW settings ride on the same endpoint and inherit the same exposure; the actual fix is N1/N2 (phase 1), already scheduled before this phase runs.
- A CI job that runs the Postgres-only numbering test automatically (§2.4) — recommended, not built here; `ci.yml` today only runs SQLite.
- Retrofitting `BTW_RATE`/`btwAmount`/`withBtw` (`pricing.ts:140-148`) to read the new `btwRate` setting — J2a's Kosten tab keeps using the existing flat-rate constant unless a future item unifies it; the invoice module computes VAT strictly per-line (§1, §4) and never calls these three helpers.

**Open risks:**
1. **Belgian VAT treatment of deposits/advances is asserted, not verified against current law** — the €1 110/€233.10 split in §4 assumes VAT is due on the deposit at the moment the deposit invoice is sent, and that the eindfactuur's deduction line must carry the same rate to avoid double-charging. This mirrors Q22's own caveat ("PO to confirm with accountant") and must be re-confirmed specifically for the deposit mechanics before real invoices go out to clients — reopening this section, not just Q22's original travel-cost question, if the accountant's answer differs.
2. **`InvoiceCounter`'s `(series, year)` reset-per-year behaviour is a design assumption**, matching the `"{year}-{seq:04d}"` example number (`2026-0001`) in the roadmap — if the PO actually wants numbers that never reset across years, that changes the counter key to `series` alone and the format template's `{year}` placeholder becomes purely cosmetic (still derivable from `invoiceDate` for display). Confirm before building §2 if this reading is wrong.
3. **Manual line edits during `concept` and a later `regenerate` are mutually destructive** (§7's `POST .../regenerate` explicitly discards manual additions) — acceptable for v1, but worth a confirmation dialog in the UI (§8.1's `create-invoice-dialog.tsx`/detail page) so a PO doesn't lose hand-added lines by accident.
4. **`GET /api/invoices` returning every matching invoice unpaginated** (§7) is fine at current/expected volumes (tens to low hundreds per year) but will need pagination if invoice volume grows substantially — not built now, flagged for whoever revisits the overview page.
5. **The credit-note "partial lines" selection** (`POST /api/invoices/[id]/credit-note` with a `lines` array, §7) needs UI care to avoid crediting more than a line's original quantity — validate `quantity <= originalLine.quantity` server-side, not just in the dialog.
