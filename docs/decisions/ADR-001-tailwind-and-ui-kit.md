# ADR-001: Adopt Tailwind CSS and a custom UI kit

## Status
Accepted

## Date
2026-10-22

## Context
The HRP client used hand-written utility classes (`.flex`, `.text-sm`, …) in `index.css` that only partially covered Tailwind's API, so many classes referenced in components (e.g. `grid`, `gap-4`, `lg:grid-cols-4`) had no styling. This produced a broken, inconsistent UI. We needed a styling approach that (a) makes the existing utility-class markup render correctly, (b) stays within the 170 kB main-JS / 250 kB total-JS bundle budget, and (c) supports the accessibility and responsive requirements in `CONSTRAINTS.md`.

## Decision
Adopt **Tailwind CSS 3.4** with PostCSS + Autoprefixer, and build a small **custom UI kit** (`packages/client/src/components/ui/`) of primitives: `Icons`, `RiskBadge`/`RiskDot`, `FormField` (`Input`, `Textarea`, `Select`, `Checkbox`), `Table`/`Pagination`, and brand marks. Keep the existing CSS-variable design tokens (`--color-primary`, etc.) and map them into the Tailwind theme where useful.

## Alternatives Considered

### Keep hand-written utilities only
- Pros: No new dependency; full control over CSS size.
- Cons: Reinventing Tailwind; partial coverage already caused broken layout; high maintenance.
- Rejected: Coverage gaps are the root cause of the broken UI.

### Adopt a component library (Radix UI / Headless UI)
- Pros: Accessible primitives out of the box; less code to maintain.
- Cons: Adds bundle weight; team unfamiliar; premature before component needs are clear.
- Rejected (for now): Re-evaluate once the UI kit grows beyond ~10 primitives (see Open Questions).

### Tailwind v4
- Pros: Newer, smaller runtime.
- Cons: Requires Vite plugin or PostCSS migration; less battle-tested at adoption time.
- Rejected: v3.4 is stable and sufficient; revisit in a later release.

## Consequences
- All utility classes used in components now render correctly; layout is responsive.
- Main JS bundle still within budget (Tailwind purges unused classes at build).
- `index.css` still contains legacy hand-written utilities; a follow-up should remove duplicates to avoid specificity/order bugs.
- New UI-kit components need unit tests (plan Task 5.1) to reach 80% changed-line coverage.
- Icons are inline SVGs (bundle cost + no tree-shaking across variants); consider `lucide-react` if the icon set grows.
