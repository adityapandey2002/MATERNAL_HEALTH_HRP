# SPEC-e2e-load

Status: Approved
Owner: QA
Depends on: authz-facility-scope, pwa-privacy, observability, referral-workflow, district-dashboards

## Objective

Prove the critical journeys work online and offline, and that the API meets pilot performance targets.

## Scope

- Playwright E2E for ANM, CHO, BHM, DHS.
- Offline registration and sync.
- Referral and supervision flows.
- Authorization denial scenarios.
- k6 load tests.

## Non-goals

- Full regression of every screen.
- Production load testing without approval.

## Functional requirements

- `FR-E2E-001`: offline patient registration -> reconnect -> sync succeeds.
- `FR-E2E-002`: duplicate push is idempotent.
- `FR-E2E-003`: ANM -> CHO -> BHM -> DHS referral visibility and acknowledgement.
- `FR-E2E-004`: supervision alert acknowledgement.
- `FR-E2E-005`: cross-facility and cross-district denial.
- `FR-E2E-006`: dashboard drill-down reaches patient within scope.
- `FR-E2E-007`: k6 p95 <= 300 ms for pilot concurrency.
- `FR-E2E-008`: sync backlog and conflict metrics are asserted.
- `FR-E2E-009`: E2E runs against a compose stack with a real API and database.

## Testing

- Playwright projects: desktop Chrome, mobile Chrome, offline.
- k6 scenarios: login, patient list, visit create, sync push/pull, dashboard.
- CI uploads traces, screenshots, and reports on failure.

## Success criteria

- Critical E2E suite passes in CI.
- Load test report attached to release.
- No P1 flow without E2E coverage.

## Boundaries

Always: use synthetic data. Ask first: production load tests. Never: test with real PHI.
