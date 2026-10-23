# Implementation Plan: HRP Araria Production Launch

Status: Approved
Last updated: 2026-10-23

## Scope

Implement all 17 launch-readiness modules in dependency order. Real patient data stays blocked until the security, audit, PWA, and backup gates pass.

## Vertical slices

### Wave 0 - Safe foundation (week 1)

1. `secrets-config`
   - Config module, `.env.example`, remove fallbacks, tests.
2. `database-lifecycle`
   - Migration ledger, ordered migrations, seed guard, scope indexes.
3. `production-packaging`
   - Root Dockerfiles, health/readiness, graceful shutdown, preview compose.

Gate: clean-clone build, invalid-config boot failure, migration idempotency, `npm run check:full`.

### Wave 1 - PHI protection (weeks 2-3)

4. `authz-facility-scope`
   - Policy, scope resolver, route enforcement, IDOR tests.
5. `phi-audit`
   - Audit schema, writer, route coverage, DHS reader, hash chain.

Gate: role/responsibility matrix, IDOR suite, audit completeness, changed-line coverage >= 80%.

### Wave 2 - Browser and API hardening (weeks 3-4)

6. `web-security`
   - CORS, CSRF, rate limits, lockout, headers, refresh rotation.
7. `pwa-privacy`
   - Remove API caching, logout wipe, private source maps, manifest config.

Gate: CORS/rate-limit/revocation tests, no PHI in Cache Storage, ZAP baseline.

### Wave 3 - District operations (weeks 4-6)

8. `observability`
   - Redacted logs, metrics, `/ready`, alerts, SLOs.
9. `district-onboarding`
   - Araria facility/user/import scripts, BLOCK level, dry-run.
10. `district-administration`
    - DHS admin UI/API, user/facility/responsibility management, audit viewer.
11. `referral-workflow`
    - Clinical routing, destination acknowledgement, nodal visibility, states.
12. `district-dashboards`
    - Scoped aggregate and patient drill-down.

Gate: staging deploy, Araria dry-run/rollback, admin audit, referral state machine, dashboard authz.

### Wave 4 - Compliance and usability (weeks 6-8)

13. `consent-retention`
    - Consent capture, retention/erasure jobs, DSAR runbook.
14. `i18n-a11y`
    - Hindi/English catalogs, clinical glossary, WCAG AA.
15. `observability` finalization
    - Alerts, dashboards, on-call.

Gate: consent capture, axe zero critical, readiness/alerts live.

### Wave 5 - Release evidence (weeks 8-10)

16. `e2e-load`
    - Offline/sync/referral/dashboard E2E, k6.
17. `cicd-release`
    - Build once, migration job, staging/prod deploy, rollback.
18. `compliance-docs`
    - DPIA, ROPA, notices, runbooks, launch checklist.

Gate: E2E and load evidence, rollback and restore drills, security review, signed release.

### Pilot (weeks 10-12)

- UAT with 10-20 ANMs, 3-5 CHOs, BHM, DHS.
- Training, paper fallback, hypercare.
- Weekly KPI review and go/no-go for expansion.

## Parallel work

- Documentation and approvals start in week 1.
- Frontend i18n can begin after PWA privacy.
- Admin UI and referral UI can proceed in parallel once authz API contracts are stable.
- Compliance docs run alongside Waves 2-5.

## Risks

| Risk | Mitigation |
|---|---|
| IDOR/PHI exposure | Wave 1 deny-by-default and IDOR suite before any pilot data |
| Workspace packaging broken | Root-context images and clean-clone build in Wave 0 |
| Sync corruption | Server-assigned versions, tombstones, batched transactional push |
| PHI in caches/logs | PWA cache exclusion, log redaction, private source maps |
| Approval/hosting delay | Start managed-cloud staging with synthetic data; run NIC/BSDC approval in parallel |

## Verification checkpoints

- After each task: `npm run check:fast`.
- After each module: `npm run check:task`.
- Before merge: `npm run check:full`.
- Before staging: E2E smoke and migration dry-run.
- Before pilot: backup restore, rollback rehearsal, security review, UAT sign-off.
