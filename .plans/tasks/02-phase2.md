# Phase 2 — Entity foundations

Order: **p2-ddl lands first (single commit, one worker)**, then B1/B2/B7/D1/D2/E1/F4 run as parallel feature workers. None of the feature workers may touch `prisma/schema*.prisma`, migrations, or seed data-shape. Read `00-README.md` first.

File-conflict rules for this phase:
- `src/components/sidebar.tsx`: **B1's worker adds all three nav items** (Klanten, Locaties, Instellingen). B2 and F4 do NOT touch the sidebar.
- `src/components/project-form.tsx`: B1 and B2 both edit it. B1 extracts a reusable combobox first (see B1 step 3); B2 rebases on it. If B2 starts first, B2 creates the same component at the same path with the same props.
- `src/lib/availability.ts` + `src/lib/pricing.ts` + period forms: owned exclusively by B7 this phase.

---

## p2-ddl — DDL commit 1 (M, one worker, lands first)

All phase-2 models + backfills + the B7 data normalization, in ONE commit. Every model goes in **both** `prisma/schema.prisma` (PG) and `prisma/schema.dev.prisma` (SQLite). No enums. Postgres migration authored via the Z1 recipe in CLAUDE.md.

New models / fields:
```prisma
model Client   { id Int @id @default(autoincrement()); name String; contactName String?; email String?; phone String?; address String?; postalCode String?; city String?; vatNumber String?; notes String?; projects Project[] }
model Location { id Int @id @default(autoincrement()); name String; address String?; postalCode String?; city String?; phone String?; notes String?; projects Project[] }
model Function { id Int @id @default(autoincrement()); name String @unique; people PersonFunction[] }
model PersonFunction { personId Int; functionId Int; person Person @relation(...); function Function @relation(...); @@id([personId, functionId]) }
model Category { id Int @id @default(autoincrement()); name String @unique; prefix String; materials Material[] }
model Setting  { key String @id; value String?; blob Bytes? }
// existing models gain:
Project:  clientId Int?  + relation; locationId Int? + relation   (legacy string columns client/location STAY)
Person:   address String?; postalCode String?; city String?; country String?; functions PersonFunction[]
Material: categoryId Int? + relation                              (legacy category string STAYS)
```

Backfills — in the Postgres migration SQL **and** mirrored in `prisma/seed.ts` (dev is seed-driven, migrations never run there):
1. Distinct non-null `Project.client` strings → `Client(name)` rows; set `Project.clientId` by name match. Same for `Project.location` → `Location`.
2. Distinct non-null `Person.role` strings → `Function` rows + `PersonFunction` links.
3. `Material.category` composites → `Category`: strip the `" - Fysiek item"` / `" - Virtuele combinatie"` suffix (see `composeCategory()` in `prisma/seed.ts:98-104`); bare `"Fysiek item"` → no category. Prefix per category = the most common 4-digit code prefix among its materials (codes live in `Material.notes`, e.g. `0401-006`) — fallback `"9999"`.
4. **B7 normalization:** `UPDATE "Period" SET "endDate" = "endDate" + interval '23 hours 59 minutes 59 seconds' WHERE "endDate"::time = '00:00:00'` (seeded periods are all midnight — `prisma/seed.ts:316-318`; mirror by seeding end times 23:59:59 directly).

Then: `npm run db:dev:generate`, extend `src/types/index.ts` with `Client`, `Location`, `Function`, `Category`, `Setting` types + new optional fields on existing types.

**Accept:** migration applies on fresh compose Postgres; `db:dev:reset` seeds clean; `npx tsc --noEmit` passes; no UI/API changes in this commit. **Out of scope:** dropping legacy string columns (later cleanup); any routes/UI.

---

## B1 — Client entity + Klanten pages (L)

Consumes p2-ddl's `Client`. Decisions: delete is **blocked** while projects reference the client (Dutch error, archiving later); legacy string still displays as fallback.
1. API `src/app/api/clients/route.ts` (GET list incl. `_count.projects`, POST) + `clients/[id]/route.ts` (GET, PUT, DELETE). Copy the people-routes pattern (`requireAuth()`, api-auth helpers, Zod). DELETE: if `_count.projects > 0` → error helper 409, message **"Klant kan niet verwijderd worden: er zijn nog projecten gekoppeld."**
2. Pages `/clients`: list + detail modeled on `src/app/(app)/people/` (client component, `useQuery(["clients"])`, form dialog `src/components/client-form.tsx` RHF+Zod — name verplicht, rest optioneel). Sidebar: add **Klanten** (`/clients`), **Locaties** (`/locations`), **Instellingen** (`/settings`) items (B1 owns all sidebar edits this phase).
3. Extract `src/components/entity-combobox.tsx`: props `{ items: {id:number; name:string}[], value?: number|null, onChange(id:number|null), onCreate?(name:string)=>Promise<{id:number}>, placeholder, createLabel }` — shadcn `Command` in a `Popover`, search, inline "+ Nieuwe klant aanmaken" calling POST then selecting.
4. `project-form.tsx`: replace free-text client input with the combobox (`clientId`); project detail shows `project.client?.name ?? legacyString`.

**Accept:** create project with existing or inline-created client; blocked delete shows the Dutch error; legacy projects render unchanged.

---

## B2 — Location entity + Locaties pages (M)

Same pattern as B1 for `Location` (free-standing, reusable across clients — decided): API `/api/locations` + `[id]` (DELETE blocked in-use: **"Locatie kan niet verwijderd worden: er zijn nog projecten gekoppeld."**), `/locations` pages, `location-form.tsx` (naam verplicht; adres/postcode/plaats/telefoon optioneel — documents need the full address later), combobox in `project-form.tsx` reusing `entity-combobox.tsx`. **Do not touch sidebar.tsx** (B1 owns it).

**Accept:** as B1; location detail shows full address.

---

## B7 — Period start/end times (L, critical — sole owner of availability.ts/pricing.ts this phase)

Schema already DateTime; normalization migration shipped in p2-ddl. Decisions: back-to-back periods do **not** conflict; timed periods everywhere.

1. **Availability (`src/lib/availability.ts:22-25, 46-49`):** the overlap conditions are inclusive (`lte`/`gte`); change to strict — a slot conflicts iff `existing.startDate < newEnd && existing.endDate > newStart`. Both blocks (people + materials).
2. **API validation:** period POST/PUT handlers parse `new Date(body.startDate)` raw (`src/app/api/periods/[id]/route.ts:18` and the create route). Add Zod `z.string().datetime({ offset: true })` — reject bare `yyyy-MM-ddTHH:mm` (parses server-local: UTC in Docker vs Brussels in dev — silent 1–2h shift).
3. **Period form (`src/components/period-form.tsx`):** switch to `datetime-local` inputs; defaults for new periods 08:00–17:00. Kill the `toISOString().slice(...)` pattern at lines 34-36 (it shifts display by the TZ offset) — populate inputs via local `format(d, "yyyy-MM-dd'T'HH:mm")`, submit `new Date(inputValue).toISOString()`. Out-of-range warning (lines 58-60): project dates stay date-only midnight — compare period end against `endOfDay(project.endDate)`.
4. **Call-site sweep:** `src/app/(app)/planning/page.tsx:50` day bucketing → interval-overlap against `startOfDay`/`endOfDay` of the bucket; `src/components/project-periods-tab.tsx:55-62` timeline range → same normalization; display everywhere via `format(d, "dd-MM-yyyy HH:mm")`. Grep `toISOString().slice` and period-date `new Date(` usages to catch stragglers.
5. **Pricing (`src/lib/pricing.ts:16-19`):** keep `differenceInCalendarDays + 1` — verify with tests that migrated periods bill identically.
6. **Vitest (Z2 exists):** end 12:00/start 12:00 → no conflict; 1-min overlap → conflict; legacy period ending 23:59:59 vs booking same day 10:00–18:00 → conflict (last day still blocked); pricing 10-05 10:00→12-05 15:00 = 3 days and 10-05 00:00→12-05 23:59:59 = 3 days; Brussels round-trip 10:00–18:00 displays 10:00–18:00.

**Accept:** tests green; planning shows a Monday-10:00 period in Monday's column; tsc clean. **Out of scope:** bundle logic (E6), cost split (B6).

---

## D1 — Functions as shared entities, M2M (L)

Consumes `Function`/`PersonFunction`. Decision: M2M; a booking picks **one** functie per assignment; `PeriodPerson.role` stays a string snapshot (historical assignments keep old text — accepted).
1. API `/api/functions` (GET, POST) + `[id]` (PUT, DELETE — blocked in use: **"Functie kan niet verwijderd worden: er zijn nog personen gekoppeld."**).
2. `person-form.tsx`: multi-select functie combobox (badges + `entity-combobox` in multi mode or a small variant) with inline **"+ Nieuwe functie"**. People API PUT/POST accept `functionIds: number[]` → replace `PersonFunction` links in a transaction.
3. Person detail: functie badges. People list: functies column replaces the legacy role string (fallback to legacy `Person.role` when no links).
4. Person-booking form (where `PeriodPerson.role` is set — find it under `src/components/`): free-text becomes a combobox pre-filled with the selected person's functies; free-text override still allowed.

**Accept:** two people share one functie; renaming it updates both; booking offers the person's functies.

---

## D2 — Person addresses (S)

Columns exist post-DDL. Add adres/postcode/plaats/land to `person-form.tsx` (Zod optional strings) + person detail display; whitelist the fields in the people POST/PUT handlers; extend the Person type usage.
**Accept:** address editable and visible on detail.

---

## E1 — Category entity + create-on-the-fly (M)

Consumes `Category`, backfill done in p2-ddl.
1. API `/api/categories` (GET, POST — Zod: name verplicht, prefix `/^\d{2,4}$/`) + `[id]` (PUT, DELETE blocked in use: **"Categorie kan niet verwijderd worden: er zijn nog materialen gekoppeld."**).
2. `material-form.tsx`: category text input → `entity-combobox` with inline create dialog (**"Nieuwe categorie"**: naam + prefix). Replaces E2's temporary text field in the detail pane too (inline edit now picks a category).
3. Materials tree pane: group by `material.category?.name ?? legacyString ?? "Zonder categorie"`.

**Accept:** pick-or-create inline; tree groups via relation; legacy rows fall back cleanly.

---

## F4 — Settings page + logo (M)

Consumes `Setting {key, value, blob}`. ADMIN-only enforcement arrives with F1 (phase 3) — v1 is login-only; state this in the PR.
1. `src/lib/settings.ts`: `getSettings(): Record<string,string>`, `setSettings(patch)`, `getLogo()/setLogo(bytes, mime)` (logo row: key `"logo"`, mime in `value`, bytes in `blob`). Keys: `companyName, companyAddress, companyPostalCode, companyCity, companyPhone, companyVat, companyIban`.
2. API `GET/PUT /api/settings` (JSON key-value, never returns blob) + `GET /api/settings/logo` (bytes + Content-Type; auth-checked — print views are authenticated pages, no proxy change) + `PUT /api/settings/logo` (multipart, image/png|jpeg, ≤1 MB — enforce in handler).
3. `/settings` page: RHF+Zod form ("Bedrijfsgegevens": Naam, Adres, Postcode, Plaats, Telefoon, BTW-nummer, IBAN, "Opslaan") + logo upload with preview ("Logo", "Uploaden", "Verwijderen"). Split into `settings-form.tsx` + `logo-upload.tsx` for the 150-line limit. Sidebar entry added by B1.

**Accept:** company info + logo round-trip; GET /api/settings JSON contains no blob; pakbon (phase 4) can consume both.
