# Reloved redesign — styling spec (READ CAREFULLY)

You are restyling internal pages of a Next.js App Router marketplace to the new
"Reloved" teal design system. **ONLY change presentation** (Tailwind classNames
and small heading/subheading copy). Do **NOT** change any logic, data fetching,
imports of server utilities, RBAC checks, redirects, server/client boundaries,
form field names, route handlers, or component props/behavior. Preserve
`"use client"` directives exactly where present. Do not add new dependencies.

## Design tokens available (Tailwind v4, already defined in globals.css)
- Brand teal scale: `brand-50 100 200 300 400 500 600 700 800 900 950`
  (600 = primary `#0d8f85`, 700 = hover)
- Text: `text-ink` (near-black headings), `text-ink-soft` (muted body/labels)
- Radii: `rounded-xl`, `rounded-2xl`
- `.card-hover` utility class (adds lift + shadow on hover) for clickable cards
- `::selection` already branded

## Exact class replacements (apply everywhere they appear)
| Old | New |
|---|---|
| `text-gray-900` | `text-ink` |
| `text-gray-800` | `text-ink` |
| `text-gray-700` | `text-ink-soft` |
| `text-gray-600` | `text-ink-soft` |
| `text-gray-500` | `text-ink-soft` |
| `text-gray-400` | `text-ink-soft` |
| `border-gray-200` | `border-brand-100` |
| `border-gray-300` (containers/cards) | `border-brand-100` |
| `border-gray-300` (form inputs) | `border-brand-200` |
| `divide-gray-100` / `divide-gray-200` | `divide-brand-50` |
| `rounded-lg` / `rounded-md` on cards, tables, panels, big buttons | `rounded-2xl` (cards/panels/tables), `rounded-xl` (buttons, inputs, small chips) |
| table `thead` `bg-gray-50` | `bg-brand-50 text-brand-700` |
| row hover `hover:bg-gray-50` | `hover:bg-brand-50/60` |
| Primary button `bg-black` / `bg-gray-900` / `bg-blue-600` / `bg-indigo-600` | `bg-brand-600 text-white hover:bg-brand-700` |
| Primary button hover `hover:bg-gray-800` etc. | `hover:bg-brand-700` |
| Secondary button `border ... text-gray-700` | `border border-brand-200 text-ink-soft hover:bg-brand-50` |
| Focus rings `focus:ring-gray-*` / `focus:ring-blue-*` / `focus:border-gray-*` | `focus:ring-brand-500 focus:border-brand-500` |
| Empty-state dashed `border-dashed border-gray-300` | `border-dashed border-brand-200` |
| Links `text-blue-600` | `text-brand-700 hover:text-brand-800` |

## Status/semantic badges — KEEP semantic colors but soften to the new palette
- Success/active/paid/released → `bg-brand-50 text-brand-700` (was green) OR keep
  `bg-green-100 text-green-700` where "green = money received" is meaningful. Prefer
  `bg-emerald-50 text-emerald-700` for a softer look.
- Danger/suspended/disputed/refunded/cancelled → `bg-rose-50 text-rose-700`
- Warning/pending/awaiting → `bg-amber-50 text-amber-700`
- Neutral/info → `bg-brand-50 text-brand-700`
- Badges should be `rounded-full px-2.5 py-0.5 text-xs font-medium`.

## Page structure conventions (apply to each page's top-level)
- Page title: `text-2xl font-semibold tracking-tight text-ink`
- Optional subtitle under title: `mt-1 text-sm text-ink-soft`
- Add a short descriptive subtitle where the page has only a bare `<h1>` and it
  reads well (keep it factual, 1 short sentence). Don't invent data.
- Cards/panels: `rounded-2xl border border-brand-100 bg-white p-5 shadow-sm`
- Section headings inside pages: `text-sm font-semibold text-ink`

## Buttons — canonical forms
- Primary: `inline-flex items-center justify-center rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50`
- Secondary: `inline-flex items-center justify-center rounded-xl border border-brand-200 px-4 py-2 text-sm font-semibold text-ink-soft transition hover:bg-brand-50`
- Destructive stays red: `... bg-rose-600 text-white hover:bg-rose-700`

## Inputs
- `w-full rounded-xl border border-brand-200 px-3 py-2 text-sm text-ink outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30`

## Hard rules
- Do not touch any file's imports except adding none. Do not remove existing
  imports even if a class is gone.
- Do not alter `getServerSession`, `getAdminContext`, `redirect`, `prisma`
  queries, `where`/`select`, or any handler.
- Keep all `href`s, form `action`s, `name`s, and component props identical.
- If a page is a client component with state/handlers, keep every hook and
  handler; restyle JSX only.
- Money/RBAC/auth logic is untouchable. Only classNames + human-readable copy.
- After editing, the file must still be valid TSX (balanced JSX, no dangling
  className quotes).
