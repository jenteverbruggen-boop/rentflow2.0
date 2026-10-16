---
name: design
description: Apply shadcn/ui design philosophy to this project. Use when designing or reviewing UI components, choosing colors, fixing contrast, updating layouts, or making any visual changes. Triggers on: "design this", "make it look good", "fix the colors", "improve the UI", "add a component".
when_to_use: Any time a visual change is made to a page or component. Always run this before marking a UI task complete.
allowed-tools: Read Grep Bash(find *)
---

# Design Skill — RentFlow

## Stack

- **shadcn/ui** components (Radix UI primitives) — never build raw custom components if a shadcn one covers the need
- **Tailwind CSS v4** with OKLCH CSS variables defined in `src/app/globals.css`
- **Dark-first** — the app runs exclusively in dark mode (`<html class="dark">`)

## Core principles

### 1. Use semantic tokens, never raw colors

Always reach for semantic CSS variable tokens. Never hardcode hex, rgb, or named Tailwind palette colors for anything that should adapt to the theme.

**Wrong:**
```tsx
<div className="bg-gray-900 text-white border border-gray-800">
```

**Right:**
```tsx
<div className="bg-card text-card-foreground border border-border">
```

Available semantic tokens (from `globals.css`):

| Token | Use for |
|---|---|
| `background` / `foreground` | Page background, primary text |
| `card` / `card-foreground` | Card surfaces |
| `muted` / `muted-foreground` | Subtle backgrounds, secondary text |
| `primary` / `primary-foreground` | CTAs, active states, brand blue |
| `secondary` / `secondary-foreground` | Secondary actions |
| `accent` / `accent-foreground` | Hover states |
| `destructive` | Errors, delete actions |
| `border` | All borders |
| `input` | Input field backgrounds |
| `ring` | Focus rings |
| `sidebar` / `sidebar-*` | Sidebar-specific surfaces |

### 2. Contrast — WCAG AA minimum

- Normal text on background: ≥ 4.5:1
- Large text / UI elements: ≥ 3:1
- `muted-foreground` on `background`: use only for truly secondary info (labels, hints), never for primary content
- Never put `muted-foreground` text on a `muted` background — contrast is too low

### 3. shadcn/ui component usage

Use the right component for the job:

| Need | Component |
|---|---|
| Modal with a form | `Dialog` + `DialogContent` + `DialogHeader` |
| Inline error | `Alert variant="destructive"` |
| Status pill | `Badge` with `statusVariant()` from `@/lib/utils` |
| Action button | `Button` with appropriate `variant` |
| Sidebar drawer (mobile) | `Sheet` |
| Data grid | `Table` |
| Dropdown selector | `Select` (not native `<select>`) |
| Form field wrapper | `Form` + `FormField` + `FormItem` + `FormLabel` + `FormControl` + `FormMessage` |

Always import from `@/components/ui/*`. Never install a new Radix primitive manually if shadcn already wraps it.

### 4. Spacing and layout rhythm

- Use Tailwind spacing scale in multiples of 4 (4, 8, 12, 16, 24, 32…)
- Page padding: `p-6` on `<main>`, `p-5` inside cards
- Stack vertical space with `space-y-6` between sections, `space-y-4` within a section, `space-y-1.5` within a form field
- Use `gap-3` or `gap-4` in grids
- Cards use `rounded-xl` (the default `--radius` + `xl` modifier)

### 5. Typography

- Page title: `text-2xl font-bold`
- Section heading: `text-base font-semibold` inside a `CardTitle`
- Body: default (no explicit class)
- Helper / secondary: `text-sm text-muted-foreground`
- Meta / timestamps: `text-xs text-muted-foreground`

### 6. Interactive states

Every clickable element must have:
- A visible hover state (`hover:bg-accent` or `hover:opacity-80`)
- A focus ring (`focus-visible:ring-2 focus-visible:ring-ring` — shadcn components do this automatically)
- A disabled state when `isPending` / `isLoading`

### 7. Status badges

Use `statusVariant(status)` from `@/lib/utils` to get the correct class string, then apply it to a `<Badge>`:

```tsx
import { Badge } from "@/components/ui/badge";
import { statusVariant } from "@/lib/utils";

<Badge className={statusVariant(project.status)}>{project.status}</Badge>
```

The mapping lives in `src/lib/utils.ts`. If new statuses are added, update the map there first.

### 8. Don't mix paradigms

- Don't add raw `bg-gray-*` to elements that already use `bg-card` — pick one
- Don't mix `text-white` with `text-foreground` in the same component
- Don't add custom border-radius values; use Tailwind's `rounded-*` with `--radius` driving the base

### 9. Mobile-first layout (required)

The app must be fully usable on a phone. Every layout decision needs a mobile answer.

**Breakpoints in use:**

| Prefix | Min-width | Meaning |
|---|---|---|
| _(none)_ | 0px | Mobile default |
| `sm:` | 640px | Large phone / small tablet |
| `md:` | 768px | Tablet portrait — content only, **no sidebar yet** |
| `lg:` | 1024px | Sidebar appears; desktop |
| `xl:` | 1280px | Wide grids (7-col week planner) |

**Sidebar:**
- Desktop (`lg+`): always-visible `aside` — `hidden lg:flex` (not `md`: at 768px a 224px sidebar leaves only 544px of content)
- Mobile: hidden; accessible via `MobileTopBar` hamburger → `Sheet` from `src/components/mobile-sidebar.tsx`
- Never show both at once; never duplicate nav logic outside these two components

**Layout structure:**
```tsx
// AppLayout — the wrapper in src/app/(app)/layout.tsx
<div className="flex h-screen bg-background">
  <Sidebar />   {/* hidden lg:flex */}
  <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
    <MobileTopBar />   {/* lg:hidden */}
    <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
  </div>
</div>
```

**Grids:**
- Stat/summary grids: `grid-cols-1 sm:grid-cols-3` — never bare `grid-cols-3`
- Card lists stay single-column on all screen sizes (already mobile-friendly)
- Calendar-like grids (`grid-cols-7`) need a column floor ≈ 120px: week planner is `grid-cols-1 md:grid-cols-4 xl:grid-cols-7`. Never `grid-cols-7` bare below `xl` for cards with text
- Stat grids with long labels ("Materiaalboekingen"): `grid-cols-2 md:grid-cols-4`, not `sm:`

**Flex rows with text + actions:**
- Text side: always add `min-w-0` + `truncate` on inner text elements
- Action side: `flex flex-wrap gap-2`; add `sm:shrink-0` only. A bare `shrink-0` on a row of 2–3 buttons is what pushed "Verwijderen"/"Intrekken" off 360px screens
- Cards with text + 2 or more buttons: stack on mobile — `flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between`
- **Page title + actions: always `<PageHeader title="…">` (`src/components/page-header.tsx`)** — never hand-roll `flex justify-between` + `flex gap-2` (non-wrapping rows made 6 pages slide sideways)
- De-prioritise secondary info on small screens: `hidden sm:block` for dates, counts, etc.

**Tables:**
- Wrap in `overflow-x-auto` so they scroll horizontally rather than overflowing — **every** bare `<table>` (including print views like `/kosten`), shadcn `Table` already does this
- Fixed-width content (A4 label sheet, `210mm`) goes in its own `overflow-x-auto print:overflow-visible` wrapper so it never widens `<main>`
- Hide low-priority columns on mobile with `hidden sm:table-cell`

**Touch targets:**
- Minimum 44×44px tap area — use `size="icon"` buttons (h-10 w-10) or add `min-h-[44px]` padding
- Never rely on hover-only affordances; active states must be visible

**Forms and dialogs:**
- `Dialog`/`Sheet` content: add `max-h-[90dvh] overflow-y-auto` so long forms scroll on mobile
- Form labels and fields stack vertically by default (no horizontal label/field pairs)

### 10. Scrollbars — one per page

`<main>` is the page scroller (`overflow-y-auto`), so a second vertical scroller inside it is a scroll-trap, especially on touch.
- Never `max-h-[Nvh] overflow-y-auto` on lists below `lg`; let content flow
- Master-detail lists (e.g. materials) may be bounded at `lg+` only, as a sticky pane: `lg:sticky lg:top-0 lg:self-start` + inner `lg:max-h-[calc(100vh-Xrem)] lg:overflow-y-auto`
- `<main>` must never scroll sideways. If it does, something inside lacks `min-w-0`, `flex-wrap`, or an `overflow-x-auto` wrapper

### 11. Responsive audit (run after any layout change)

`.claude/skills/design/scripts/responsive-audit.mjs` drives Playwright across 21 routes × 7 widths (360, 390, 768, 1024, 1280, 1440, 1920) and reports pages where `<main>` scrolls sideways, nested vertical scrollers, and elements past the right edge.

```bash
# throwaway dir outside the repo (playwright is not a project dependency)
mkdir -p /tmp/rf-audit/shots && cd /tmp/rf-audit && npm init -y && npm i playwright && npx playwright install chromium
npm run dev -- -p 3100          # in the repo; seeded login admin@rentflow.dev / admin123
cp <repo>/.claude/skills/design/scripts/responsive-audit.mjs . && node responsive-audit.mjs /tmp/rf-audit   # writes audit.json + shots/
```

Target: zero entries with `H main`, zero `off`, and only the documented nested scrollers (materials list at lg+, label picker). Add new routes to the `routes` array. Look at the 390 and 768 screenshots too — metrics don't catch squashed or truncated content (the planning grid passed numerically while unreadable).

Baseline (2026-10-16): before fixes 10 pages slid sideways at 360–390 and 3 at 768; after, 0. Report: `.plans/ui-responsive-audit.pdf`.

### 12. Both themes, icons, navigation (learned in UI round 2)

- **Always review light AND dark.** Toggle via `localStorage.theme = "light" | "dark"` (the `dark` class on `<html>`); the audit scripts can set it with `addInitScript`. The app is not dark-only.
- **Borders:** `globals.css` has a base layer setting `border-color: var(--border)`. Tailwind v4 otherwise draws bare `border` / `border-b` in `currentColor` (full white in dark, black in light). Never remove that layer; never add `border-white` / `border-black`.
- **Every `text-*-foreground` class needs a token** defined in `:root`, `.dark` and `@theme inline`. `--destructive-foreground` was missing, which gave black-on-red badges in light mode.
- **Icons are lucide, not emoji** (`lucide-react`, `h-4 w-4`; `h-3.5 w-3.5` in dense rows). Emoji render differently per OS and can't be themed. Icon-only buttons need `aria-label`. Nav icons are string keys in `src/lib/nav-links.ts` mapped in `nav-link-list.tsx` (server → client boundary).
- **Navigation:** one renderer, `NavLinkList`, for sidebar and mobile sheet: grouped (Werk / Gegevens / Financieel / Beheer), current page highlighted via `aria-current`. New pages get a `group` in `nav-links.ts`. Keep the full sidebar within a 768px-high window (no inner scrollbar) — re-run the audit when adding items.
- **Project actions:** primary action visible, secondary print/export actions in a `DropdownMenu` (e.g. "Afdrukken ▾") instead of a row of equal-weight buttons.
- **Dashboard tiles:** `lucide` icon top-right of the header, `tabular-nums` value; group related tiles into rows (counts / money).

- **One primary button per page.** Export / import / labels / "manage" actions go in `PageActionsMenu` (the ⋯ next to the primary button, `src/components/page-actions-menu.tsx`), not as a row of equal-weight outline buttons.
- **Inline icons in running text** (counters, warnings, "shared with…"): `<InlineIcon icon={Users} />` from `components/inline-icon.tsx`. Pictographic emoji are not used anywhere in the UI; arrows and ✓/✕ typography are fine.
- **Status pills** (invoices etc.): soft tints (`border-x/30 bg-x/10 text-x-700 dark:text-x-300`), never solid saturated fills — a list full of one status must not be a wall of red.
- **Card titles** inside pages are `text-base` (CardTitle defaults to `text-2xl`); never repeat the page `<h2>` as the first card title.
- **Wide tables** on cards get `className="table-sticky-first"` (first column stays visible while scrolling sideways below `lg`). **Scrolling tab strips** get `fade-edge-r`.
- **Long lists** (projects, and any list that grows with history) default to the working set and offer search + status chips: see `ProjectsToolbar` + `filterProjects` (pure, unit-tested). When a search has matches hidden by the filter, say so and offer "Toon alles".
- **Phone rows** with name + badge + actions: name on its own full-width line, badge/amount/actions on a second line (`flex-wrap`, `basis-full sm:basis-0`), never truncate the name to make room for buttons.

## Checklist before finishing any UI change

- [ ] All colors use semantic tokens (no raw palette colors)
- [ ] Text contrast passes WCAG AA on its background
- [ ] Used the correct shadcn/ui component (not a DIY alternative)
- [ ] Interactive elements have hover + focus + disabled states
- [ ] Spacing follows the 4pt rhythm
- [ ] Status indicators use `statusVariant()`
- [ ] No new Radix dependencies installed when shadcn already covers it
- [ ] Tested (or reasoned through) at 375px width — no horizontal overflow, grids collapse, text truncates
- [ ] Looked at it in **both** light and dark theme
- [ ] Also checked 768px (content-only, no sidebar) and 1024px (sidebar, 752px content)
- [ ] Page title row uses `PageHeader`; action groups wrap
- [ ] No new nested vertical scroller below `lg`; `main` does not scroll sideways (run responsive-audit for layout changes)
