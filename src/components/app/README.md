# Exchange portal UI kit (revamp)

Source of truth for visuals: Figma "Exchange Portal — Revamp Wireframes"
(https://www.figma.com/design/SO1sc7LFpGMU7ZUBAk22MT), page "02 · Staff portal".
Brand: KOTU Brand Guidelines v2.0. Indigo `#02019B` primary, Poppins headings, Inter UI text.

## Tokens (Tailwind classes, never raw hex)
- Surfaces: `bg-background` (canvas), `bg-card` (white), `bg-muted`, `bg-accent` (indigo tint).
- Text: `text-foreground`, `text-muted-foreground`, `text-faint` (placeholder-level), `text-primary`.
- Status: `success | warning | destructive | info` with `/10` tints for backgrounds.
- Borders: `border-border` (default), `border-input` (form controls, hover).
- Radius: cards `rounded-xl`, controls `rounded-lg`, pills `rounded-full`.
- Shadows: almost none. Cards are bordered; overlays use `shadow-overlay`.
- Headings: `font-heading` (Poppins) is applied automatically to h1–h4.
- Numbers: add `tabular` for aligned figures.

## Components (`@/components/app`)
`PageHeader` (title, description, actions, breadcrumb) · `SectionCard` (titled card) ·
`KpiCard` (clickable via `to`/`onClick`, `active`) · `ViewTabs` (saved views with counts) ·
`FilterChip` · `SearchField` · `BulkBar` + `BulkBarButton` (floating dark bar) ·
`Stepper` · `EmptyState` · `RowSkeleton` · `KV` (label/value row) ·
`ToneBadge` / `StatusBadge` (unified exchange status) / `PaymentBadge` · `initials()` · `formatINR()`.

UI primitives (`@/components/ui/*`) are restyled shadcn: Button variants
`default | secondary | outline | soft | ghost | destructive | link`, sizes `default(36px) | sm | lg | icon | icon-sm`.
Select has the aligned chevron built in. Never hand-roll a dropdown trigger with a ChevronDown;
use `Select` or `DropdownMenu` + `Button variant="secondary"` with `<ChevronDown />` as the last child.

## Unified status
`getExchangeStatus(ticket)` (`@/lib/exchangeStatus`) maps DB stage+status to one status
(label, tone, step, nextAction). Use it for every status display. Never show raw stage/status enums.

## Layout & responsiveness
- Pages render inside `<Layout>` (sidebar + top bar + phone tab bar). Do not add page-level padding;
  Layout provides it. Use `space-y-5` / `gap-5` between sections.
- Breakpoints: phone < 768 (`md`), tablet 768–1279, desktop ≥ 1280 (`xl`).
- Tables: show `<table>` from `md` up; below `md` render the same rows as stacked cards.
  Hide low-priority columns on tablet with `hidden lg:table-cell`.
- Side panels: on `lg+` a right-hand panel beside the list; below `lg` use `Sheet` (side="right" or bottom).
- Sticky primary action on phones for detail pages: `fixed bottom-16 inset-x-0 md:static`.
- Touch targets ≥ 36px; inputs use `text-base md:text-sm` (avoids iOS zoom).

## Interaction
- Transitions: `duration-150 ease-out-soft` for hover/focus; `animate-fade-in` for page and panel entry.
- Every list has loading (`RowSkeleton`), empty (`EmptyState`) and error states.
- Destructive actions confirm with a dialog (not `window.confirm`).
- Toasts: `useToast` (`@/hooks/use-toast`) for outcomes.

## Routes
`/dashboard`, `/exchanges`, `/exchanges/new`, `/exchanges/:id`, `/orders`, `/warehouse`,
`/shipments`, `/cases`, `/finance`, `/users`, `/settings`. Link to tickets with `/exchanges/:id`.
