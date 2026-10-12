# Agent Instructions — HRP Tracking Platform

## Read First

**Read `CONSTRAINTS.md` before writing code. Do not weaken it to make a change pass.**

## Project Context

- **Product:** Multi-tier High-Risk Pregnancy tracking for India's public health system
- **MVP:** Offline-first PWA (ANM mobile) + CHO desktop dashboard + supervision layer
- **Stack:** React + Vite + TypeScript, RxDB/WatermelonDB, Fastify/Node, PostgreSQL
- **Timeline:** 6-8 months, 5-8 devs, 1 district pilot
- **Key doc:** `docs/ideas/hrp-tracking-mvp.md`

## Quality Gates

| Stage | Command | Must Pass |
|-------|---------|-----------|
| After edit | `npm run check:fast` | Types, lint, secrets, floor |
| Task complete | `npm run check:task` | Fast + coverage on changed lines ≥ 80% |
| PR / CI | `npm run check:full` | All + security scans |
| Preview deploy | `npm run check:perf && npm run check:a11y && npm run check:bundle` | LCP ≤ 2.5s, CLS ≤ 0.1, zero critical a11y, bundle ≤ 170 kB |

## Red Lines (Floor)

Never introduce:
- `@ts-ignore`, `eslint-disable`, `# noqa`, `# type: ignore`
- `throw new Error("Not implemented")` or empty `catch {}`
- Skipped/deleted tests without commit message reason
- Secrets in source (API keys, tokens, passwords)

## Review Checklist

Before marking a task complete, verify the diff does not:
- [ ] Weaken any threshold in `CONSTRAINTS.md`
- [ ] Add test skips or remove assertions
- [ ] Add suppression comments
- [ ] Leave stubs or `TODO` in place of implementation
- [ ] Add exception rows without discussion

## Architecture Boundaries (enforced via dependency-cruiser when configured)

- `src/client/` (PWA) → never imports `src/server/`
- `src/server/` → never imports `src/client/`
- `src/shared/` → types, utilities, rule engine only
- `src/db/` → database layer only, no HTTP logic

## Testing Principles

- **Unit:** Pure functions (rule engine, date utils, validators) — Vitest
- **Integration:** API routes, DB repositories — Vitest + testcontainers
- **E2E:** Offline sync, ANM→CHO flow, supervision alerts — Playwright
- **Coverage target:** Changed lines ≥ 80% (not project coverage)

## Security Baseline

- All secrets via environment variables (never committed)
- JWT: short-lived access (15m), httpOnly refresh cookie
- Input validation: Zod schemas on every endpoint
- Rate limiting: 100 req/min per IP on auth, 500 on API
- SQL: parameterized queries only (Kysely/Prisma/Knex)

## Performance Budgets

| Metric | Budget |
|--------|--------|
| LCP | ≤ 2500 ms |
| CLS | ≤ 0.1 |
| Main JS (gz) | ≤ 170 kB |
| Total JS (gz) | ≤ 250 kB |
| API p95 | ≤ 300 ms |

## Accessibility Baseline

- Semantic HTML, proper heading hierarchy
- Focus visible, keyboard operable
- Color contrast ≥ 4.5:1 (AA)
- ARIA only where native HTML insufficient
- Test with axe + screen reader (NVDA) on preview

---

*Generated from constraint-driven-development skill. Update `CONSTRAINTS.md` to change thresholds; this file mirrors the decisions.*