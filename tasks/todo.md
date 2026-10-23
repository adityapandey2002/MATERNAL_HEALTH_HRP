# Task List: HRP Araria Production Launch

Status key: [ ] pending, [x] complete, [~] in progress

## Wave 0 - Safe foundation

- [ ] Task: Create typed server config module
  - Acceptance: production rejects weak/default secrets; errors list variable names only
  - Verify: unit tests + boot failure test; `npm run check:task`
  - Files: `packages/server/src/config.ts`, `config.test.ts`, `index.ts`, `routes/auth.ts`, `db/client.ts`, `.env.example`

- [ ] Task: Add migration ledger and ordered migrations
  - Acceptance: re-run is a no-op; checksum drift fails; seed guard blocks production
  - Verify: migration integration test; `npm run check:task`
  - Files: `packages/server/src/db/migrate.ts`, `migrations/`, `db/seed.ts`, `package.json`

- [ ] Task: Add scope indexes and sync queue facility
  - Acceptance: `sync_queue.facility_id` exists; path and updated-at indexes exist
  - Verify: migration test; query plan check
  - Files: migrations, `db/types.ts`

- [ ] Task: Fix production containers
  - Acceptance: root-context images build; non-root; health/readiness; graceful shutdown
  - Verify: clean-clone `docker build`; compose smoke
  - Files: `Dockerfile.server`, `Dockerfile.client`, `packages/*/Dockerfile`, `docker-compose*.yml`, `nginx*.conf`, `src/index.ts`

## Wave 1 - PHI protection

- [ ] Task: Implement authz policy and scope resolver
  - Acceptance: ANM/CHO/BHM/DHS matrix; path subtree; no client widening
  - Verify: unit tests; `npm run check:task`
  - Files: `packages/server/src/authz/*`, tests

- [ ] Task: Enforce scope on patient and visit routes
  - Acceptance: IDOR denied; list scope before pagination; audit reads
  - Verify: integration tests
  - Files: `routes/patients.ts`, `routes/visits.ts`

- [ ] Task: Enforce scope on referral, supervision, queue, sync, facilities
  - Acceptance: no global queue; sync rejects out-of-scope pushes
  - Verify: integration tests
  - Files: related routes, `db/types.ts`

- [ ] Task: Add audit schema and writer
  - Acceptance: append-only; hash chain; no PHI metadata
  - Verify: audit tests; tamper test
  - Files: migrations, `src/audit/*`, `db/types.ts`

- [ ] Task: Emit audit events across routes
  - Acceptance: every sensitive success/denial emits exactly one event
  - Verify: route audit matrix test
  - Files: routes, audit helpers

## Wave 2 - Web and PWA hardening

- [ ] Task: Lock down CORS, headers, rate limits, lockout
  - Acceptance: allowlist; 100/min auth; 500/min API; 60/min sync; headers present
  - Verify: security integration tests
  - Files: `src/index.ts`, `package.json`, config

- [ ] Task: Add refresh rotation and revocation
  - Acceptance: replay fails; logout/password/role/facility change revoke
  - Verify: auth integration tests
  - Files: `routes/auth.ts`, migrations, session store

- [ ] Task: Remove API caching and wipe local data
  - Acceptance: no PHI in Cache Storage; logout wipes IndexedDB/localStorage/cache
  - Verify: Playwright inspection test
  - Files: `vite.config.ts`, `src/utils/sw.ts`, auth provider

## Wave 3 - District operations

- [ ] Task: Add BLOCK level and onboarding import
  - Acceptance: Araria fixture imports; cycles/duplicates rejected; idempotent
  - Verify: import tests; dry-run
  - Files: migrations, `scripts/onboard.mjs`, shared types

- [ ] Task: Build DHS admin API and UI
  - Acceptance: user/facility/responsibility management; last-DHS guard; audit
  - Verify: integration + component tests
  - Files: `routes/admin.ts`, `pages/Admin*.tsx`, tests

- [ ] Task: Implement referral state machine and nodal visibility
  - Acceptance: destination acknowledgement; block/district nodal; audited transitions
  - Verify: state-machine + visibility tests
  - Files: `routes/referrals.ts`, shared schemas, `pages/Referrals.tsx`

- [ ] Task: Implement scoped dashboards with drill-down
  - Acceptance: aggregate + patient drill-down within scope; audit patient views
  - Verify: scope + aggregate tests; axe
  - Files: `routes/dashboard.ts`, `pages/Dashboard.tsx`, shared types

- [ ] Task: Add readiness, metrics, alerts, redacted logs
  - Acceptance: `/ready` checks DB + migration; no PHI in logs; alerts defined
  - Verify: readiness test; redaction test
  - Files: `src/index.ts`, `src/observability/*`, docs

## Wave 4 - Compliance and usability

- [ ] Task: Add consent capture and retention jobs
  - Acceptance: consent version/language stored; purge audited; withdrawal supported
  - Verify: integration tests
  - Files: migrations, `routes/patients.ts`, `src/retention/*`, UI

- [ ] Task: Add Hindi/English catalogs and accessibility fixes
  - Acceptance: pilot strings externalized; Hindi sign-off; axe zero critical
  - Verify: i18n tests; axe; keyboard script
  - Files: `src/i18n/*`, pages, tests

- [ ] Task: Add E2E and load tests
  - Acceptance: offline sync, referral, dashboard, denial; k6 p95 <= 300 ms
  - Verify: Playwright + k6 reports
  - Files: `packages/client/src/test/e2e/*`, `load/*`, CI

## Wave 5 - Release

- [ ] Task: Add staging/production deploy and rollback workflows
  - Acceptance: build once, migrate, smoke, approval, rollback
  - Verify: staging deploy; rollback rehearsal
  - Files: `.github/workflows/*`, docs/runbooks

- [ ] Task: Complete compliance and launch docs
  - Acceptance: DPIA, ROPA, notices, breach plan, checklist signed
  - Verify: review checklist
  - Files: `docs/compliance/*`, `docs/launch/*`, `docs/runbooks/*`

- [ ] Task: Reconcile final docs and README
  - Acceptance: no false deployment claims; env matrix; links valid
  - Verify: docs review
  - Files: `README.md`, `docs/STARTUP.md`, `AGENTS.md`, `CONSTRAINTS.md`
