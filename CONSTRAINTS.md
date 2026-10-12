# Constraints — HRP Tracking Platform

Last reviewed: 2026-10-12 by @aditya

## Floor (always enforced, no setup required)

- No new suppression comments: `@ts-ignore`, `eslint-disable`, `# noqa`, `# type: ignore`
- No unimplemented stubs: `throw new Error("Not implemented")`, empty `catch {}`
- No skipped or deleted tests without a reason in the commit message
- No secrets in source
- This file does not get weakened to make a change pass

## Enforced with numbers

| Dimension | Rule | Checked by | Runs at |
|-----------|------|------------|---------|
| Types | Zero TypeScript errors | `tsc --noEmit` | every edit (fast) |
| Lint | Zero errors from Biome config | `biome check --error-on-warnings` | every edit (fast) |
| Secrets | No secrets in source | `gitleaks detect --redact --no-banner` | every edit (fast) |
| Coverage | Changed lines ≥ 80% covered | `vitest run --coverage` + git diff | task end (verify) |
| Security: code | No high/critical Semgrep findings | `semgrep scan --config p/default --config p/owasp-top-ten --json=semgrep.json` | CI (review) |
| Security: deps | No high/critical vulnerabilities | `osv-scanner scan source -r . --format json` | CI (review) |
| Performance: page | LCP ≤ 2500ms, CLS ≤ 0.1, Perf score ≥ 90 | `lighthouse $PREVIEW_URL --output=json --quiet --only-categories=performance` | preview deploy (review) |
| Performance: bundle | Main JS ≤ 170 kB gzipped | `size-limit --json` | CI (review) |
| Accessibility | Zero critical or serious axe violations | `axe $PREVIEW_URL --tags wcag2a,wcag2aa,wcag21aa --exit` | preview deploy (review) |

> **Stack assumed:** React + Vite + TypeScript, Vitest, Playwright, Fastify/Node, PostgreSQL.  
> Update the `Checked by` commands if stack differs.

## Measured, not yet enforced (ratchets)

| Metric | Today | Direction |
|--------|-------|-----------|
| Project coverage (all lines) | 0% | must not fall |
| Mutation score (Stryker) | N/A | ≥ 60% when enabled |
| Bundle size (main) | 0 kB | must not grow > 10% per release |

## Exceptions

| ID | Rule | Path | Reason | Owner | Expires |
|----|------|------|--------|-------|---------|
| W1 | `no-explicit-any` | `src/legacy/**` | Legacy integration, rewrite tracked in ENG-XXX | @aditya | 2027-01-12 |

---

## Check scripts (add to package.json)

```json
{
  "scripts": {
    "check:fast": "tsc --noEmit && biome check --error-on-warnings && gitleaks detect --redact --no-banner",
    "check:task": "npm run check:fast && vitest run --coverage",
    "check:full": "npm run check:task && semgrep scan --config p/default --config p/owasp-top-ten && osv-scanner scan source -r .",
    "check:perf": "lighthouse $PREVIEW_URL --output=json --quiet --only-categories=performance",
    "check:a11y": "axe $PREVIEW_URL --tags wcag2a,wcag2aa,wcag21aa --exit",
    "check:bundle": "size-limit --json"
  }
}
```

## Lifecycle mapping

| Phase | Command | What runs | Budget |
|-------|---------|-----------|--------|
| BUILD (post-edit) | `npm run check:fast` | Types, lint, secrets, floor | < 5s |
| VERIFY (task end) | `npm run check:task` | Fast + coverage on changed lines | < 90s |
| REVIEW (PR/CI) | `npm run check:full` | All + security deps + code | minutes |
| PREVIEW DEPLOY | `npm run check:perf && npm run check:a11y && npm run check:bundle` | Lighthouse, axe, size-limit | < 3 min |

## Guard checks (review-time, no tool needed)

At review, the reviewer (human or agent) verifies the diff does not contain:

1. **Threshold changes** — `CONSTRAINTS.md` numbers lowered, severity dropped, check removed from fast stage
2. **Test weakening** — `.skip` added, test file deleted, assertions removed from passing tests
3. **Checker silencing** — New `@ts-ignore`, `eslint-disable`, `istanbul ignore`, `Stryker disable`, `nosemgrep`, `gitleaks:allow`
4. **Unfinished work** — Stubs throwing, empty `catch`, `TODO` where implementation belongs
5. **New exceptions** — Rows added to Exceptions table without discussion

---

## Notes for this project

- **Offline-first PWA** means Playwright E2E tests must run against a local dev server with Service Worker registered; `check:task` should include `playwright test --project=offline` once E2E suite exists.
- **IndexedDB / RxDB** code paths are hard to unit-test; prioritize E2E coverage for sync engine.
- **ABDM/FHIR integration (v2)** will add schema validation tests; budget for them in coverage.
- **District pilot (month 7-8)** — preview deploy checks (perf, a11y, bundle) only matter once a preview URL exists. Before that, those rows are "measured only."