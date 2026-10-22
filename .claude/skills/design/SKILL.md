---
name: design
description: Apply shadcn/ui design philosophy to this project. Use when designing or reviewing UI components, choosing colors, fixing contrast, updating layouts, or making any visual changes. Triggers on: "design this", "make it look good", "fix the colors", "improve the UI", "add a component".
when_to_use: Any time a visual change is made to a page or component. Always run this before marking a UI task complete.
allowed-tools: Read Grep Bash(find *)
---

# Design Skill — RentFlow

## Stack

- **shadcn/ui** (Radix) components from `@/components/ui/*`. Don't build a
  custom component when shadcn covers it, and don't install a Radix primitive
  that shadcn already wraps.
- **Tailwind v4**, OKLCH tokens in `src/app/globals.css`.
- **Light and dark theme.** Dark is the default. `localStorage.theme = "light"`
  removes the `dark` class from `<html>` (see the script in
  `src/app/layout.tsx`). **Always review both themes.**
- **Dutch UI.** Labels, buttons and messages are in Dutch.

## 1. Colors: semantic tokens

Use tokens, never raw `bg-gray-900` / `text-white` / hex:

| Token | Use for |
|---|---|
| `background` / `foreground` | Page, primary text |
| `card` / `card-foreground` | Card surfaces |
| `muted` / `muted-foreground` | Subtle backgrounds, secondary text |
| `primary` / `primary-foreground` | CTAs, active states |
| `secondary` / `secondary-foreground` | Secondary actions |
| `accent` / `accent-foreground` | Hover states |
| `destructive` / `destructive-foreground` | Errors, delete |
| `border` · `input` · `ring` | Borders, inputs, focus rings |
| `sidebar` / `sidebar-*` | Sidebar surfaces |

- Every `text-*-foreground` class needs a token in `:root`, `.dark` **and**
  `@theme inline`. A missing `--destructive-foreground` once gave black-on-red
  badges in light mode.
- **Borders:** a base layer in `globals.css` sets `border-color: var(--border)`.
  Without it, Tailwind v4 draws a bare `border` in `currentColor`. Never remove
  that layer, and never use `border-white` / `border-black`.
- **Exception: status tints.** Status pills are the only place raw palette
  colors are allowed, as soft tints:
  `border-x-600/30 bg-x-600/10 text-x-700 dark:text-x-300`. Never use a solid
  saturated fill, because a list where every item has the same status must not
  turn into a wall of red. Project statuses: `statusVariant()` in
  `src/lib/utils.ts`. Invoice and quote statuses: `InvoiceStatusBadge`. Add new
  statuses to those maps, not inline.

## 2. Contrast: WCAG AA

- Body text ≥ 4.5:1. Large text and UI elements ≥ 3:1. Check in both themes.
- `muted-foreground` is for secondary info only, and never on a `muted`
  background.

## 3. Components

| Need | Use |
|---|---|
| Page title + actions | `PageHeader` (`src/components/page-header.tsx`) |
| Secondary page actions (export, import, labels, manage) | `PageActionsMenu` (the ⋯ next to the single primary button) |
| Secondary print/export on a detail page | `DropdownMenu` ("Afdrukken ▾") |
| Modal form | `Dialog` + `DialogContent` + `DialogHeader` |
| Mobile drawer | `Sheet` |
| Inline error | `Alert variant="destructive"` |
| Status | `Badge` + `statusVariant()` / `InvoiceStatusBadge` |
| Dropdown | `Select` (not native `<select>`) |
| Data grid | `Table` |
| Form field | `Form` + `FormField` + `FormItem` + `FormLabel` + `FormControl` + `FormMessage` |
| Icon in running text | `<InlineIcon icon={Users} />` (`src/components/inline-icon.tsx`) |
| Print documents | `PrintLayout` + `DocumentHeader` |

**One primary button per page.** Don't put a row of equal-weight outline
buttons next to it.

**Icons are `lucide-react`, never emoji.** Use `h-4 w-4` (`h-3.5 w-3.5` in
dense rows). Icon-only buttons need an `aria-label`. Arrows and ✓/✕ as
typography are fine.

## 4. Spacing and typography

- Spacing in multiples of 4. `<main>` has `p-4 md:p-6` (set in the layout, so
  don't repeat it on a page). Use `p-5` inside cards.
- `space-y-6` between sections, `space-y-4` within a section, `space-y-1.5`
  within a field. `gap-3` / `gap-4` in grids. Cards are `rounded-xl`. No custom
  radius values.
- Page title: `text-2xl font-bold`, via `PageHeader`.
- Card titles: `text-base font-semibold` (`CardTitle` defaults to `text-2xl`,
  so override it). Never repeat the page title as the first card title.
- Secondary text: `text-sm text-muted-foreground`. Meta and timestamps:
  `text-xs text-muted-foreground`. Numbers in tiles and tables: `tabular-nums`.

## 5. Interactive states

Every clickable element needs a hover state, a focus ring
(`focus-visible:ring-2 focus-visible:ring-ring`; shadcn components already have
one) and a disabled state while `isPending`. Don't rely on hover alone.

## 6. Mobile-first layout (required)

| Prefix | Min width | Meaning |
|---|---|---|
| _(none)_ | 0 | Phone |
| `sm:` | 640 | Large phone |
| `md:` | 768 | Tablet. Content only, **no sidebar yet** |
| `lg:` | 1024 | Sidebar appears (752px content) |
| `xl:` | 1280 | Wide grids (7-col week planner) |

**Shell** (`src/app/(app)/layout.tsx`): `Sidebar` (`hidden lg:flex`) and
`MobileTopBar` (`lg:hidden`, which opens a `Sheet` from `mobile-sidebar.tsx`).
Both render the same `NavLinkList`. Nav items are grouped (Werk / Gegevens /
Financieel / Beheer) in `src/lib/nav-links.ts`, and a new page gets a `group`
there. The full sidebar has to fit in a 768px-high window without an inner
scrollbar.

**Grids**
- Stat grids: `grid-cols-1 sm:grid-cols-3`, or `grid-cols-2 md:grid-cols-4`
  when labels are long. Never a bare `grid-cols-3`.
- Calendar grids need a column floor of about 120px. The week planner is
  `grid-cols-1 md:grid-cols-4 xl:grid-cols-7`.

**Rows with text + actions**
- Text side: `min-w-0` plus `truncate` on the text.
- Actions: `flex flex-wrap gap-2`, and at most `sm:shrink-0`. A bare `shrink-0`
  pushes buttons off a 360px screen.
- Text + 2 or more buttons: `flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between`.
- Phone rows with name + badge + actions: the name goes on its own full-width
  line, and badge / amount / actions on a second line (`basis-full sm:basis-0`).
  Never truncate the name to make room for buttons.
- Hide secondary info on small screens with `hidden sm:block`.

**Tables:** wrap every bare `<table>` in `overflow-x-auto` (shadcn `Table`
already does this). Hide low-priority columns with `hidden sm:table-cell`. Wide
card tables get `table-sticky-first`. Scrolling tab strips get `fade-edge-r`.
Fixed-width content (an A4 label sheet) gets its own
`overflow-x-auto print:overflow-visible` wrapper.

**Touch:** tap targets at least 44×44px (`size="icon"` or `min-h-[44px]`).

**Dialogs and sheets:** `max-h-[90dvh] overflow-y-auto`. Labels go above
fields.

**Long lists** that grow with history default to the working set, with search
and status chips (`ProjectsToolbar` + the pure `filterProjects`). When a search
has matches that the filter hides, say so and offer "Toon alles".

## 7. Scrolling: one scroller per page

`<main>` is the page scroller.
- Below `lg`, never put `max-h-[…] overflow-y-auto` on a list.
- A master-detail list may be bounded at `lg+` as a sticky pane:
  `lg:sticky lg:top-0 lg:self-start` plus an inner
  `lg:max-h-[calc(100vh-Xrem)] lg:overflow-y-auto`.
- `<main>` must never scroll sideways. If it does, something is missing
  `min-w-0`, `flex-wrap` or an `overflow-x-auto` wrapper.

## 8. Responsive audit (after any layout change)

`scripts/responsive-audit.mjs` loads every `(app)` route at 7 widths (360 to
1920) and reports a sideways-scrolling `<main>`, nested vertical scrollers and
elements past the right edge. Run it against the QA server (fresh seed, so the
ids are stable):

```bash
npx playwright install chromium                     # once
bash qa/serve.sh &                                   # fresh seeded build on :3100
node .claude/skills/design/scripts/responsive-audit.mjs /tmp/rf-audit   # → audit.json + shots/
```

Target: no `docH`, no `off`, and only the expected nested scrollers (the
materials list at lg+ and the label picker). When you add a page, add it to the
`routes` array. Also look at the 390 and 768 screenshots, because the numbers
don't catch squashed or unreadable content.

- **Radix `ScrollArea` clips wide rows:** its viewport wraps children in a `display: table` div that grows to the widest nowrap content and pushes right-hand action buttons out of view. Always add `[&>[data-radix-scroll-area-viewport]>div]:block!` to the `ScrollArea` className (done in all pickers).
- **Editable cost tables** (`.cost-table` in Kosten tab) turn into one card per line below `md` via CSS in `globals.css` (screen only, print keeps the table); keep the cell order (icon, name, berekening, korting, projectprijs, subtotaal) when adding columns.
- **Timelines** (`components/timeline.tsx`) use a `--tl-lw` label column (96px on phones, 180px from `sm`) and show every second tick label on phones; labels in the last 15% hang left of their tick so the frame never clips them.
- **Audit every tab, not just the page:** a detail page with tabs must be checked tab by tab at 360/390/768/1024/1280 (Kosten was the worst offender and only showed on its own tab).
- **Dev-server gotcha:** CSS edited outside the editor (scripts) is sometimes not picked up by Turbopack; if a new rule "does nothing", `rm -rf .next` and restart before debugging the CSS.

## Checklist before finishing a UI change

- [ ] Semantic tokens only (status tints excepted); AA contrast
- [ ] Looked at it in **light and dark**
- [ ] Correct shadcn component; `PageHeader`; one primary button; lucide icons
- [ ] Hover, focus and disabled states
- [ ] 360/390px: no horizontal overflow, grids collapse, action rows wrap
- [ ] 768px (no sidebar) and 1024px (sidebar, 752px content)
- [ ] No new nested scroller below `lg`; responsive audit run for layout changes
