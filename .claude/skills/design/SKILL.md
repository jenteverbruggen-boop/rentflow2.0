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

## Checklist before finishing any UI change

- [ ] All colors use semantic tokens (no raw palette colors)
- [ ] Text contrast passes WCAG AA on its background
- [ ] Used the correct shadcn/ui component (not a DIY alternative)
- [ ] Interactive elements have hover + focus + disabled states
- [ ] Spacing follows the 4pt rhythm
- [ ] Status indicators use `statusVariant()`
- [ ] No new Radix dependencies installed when shadcn already covers it
