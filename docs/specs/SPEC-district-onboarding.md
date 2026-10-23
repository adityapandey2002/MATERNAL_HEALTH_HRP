# SPEC-district-onboarding

Status: Approved
Owner: Product + District Coordinator + Backend
Depends on: database-lifecycle, authz-facility-scope

## Objective

Load the authoritative Araria facility hierarchy and user roster safely, with validated paths and repeatable imports.

## Scope

- CSV import for facilities and users.
- Path generation and validation.
- Bulk nodal responsibility assignment.
- Dry-run, reconciliation, and rollback.

## Non-goals

- Ongoing user administration UI; that is `district-administration`.

## Functional requirements

- `FR-ONB-001`: facility CSV columns: code, name, level, parent_code, block, state, district.
- `FR-ONB-002`: import rejects missing parents, duplicate codes, cycles, and malformed paths.
- `FR-ONB-003`: `facilities.path` uses stable codes and includes BLOCK.
- `FR-ONB-004`: user CSV columns: employee_id, name, phone, role, facility_code, language.
- `FR-ONB-005`: import is idempotent and reports created/updated/skipped counts.
- `FR-ONB-006`: no default password; one-time credentials are generated and force change.
- `FR-ONB-007`: bulk `REFERRAL_NODAL` assignments are supported at facility, block, or district scope.
- `FR-ONB-008`: dry-run mode and rollback runbook exist.

## Testing

- Fixture with valid Araria hierarchy imports successfully.
- Missing parent, duplicate code, and cycle fixtures fail with clear errors.
- Re-run is a no-op.
- Path scope tests match authz predicates.

## Success criteria

- District validates facility/user counts.
- No demo users or Gujarat facilities in production.
- Import rollback rehearsed.

## Boundaries

Always: validate hierarchy. Ask first: schema changes. Never: seed production with demo passwords.
