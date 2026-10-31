# SPEC-authz-facility-scope

Status: Approved
Owner: Backend + Security
Depends on: secrets-config, database-lifecycle

## Objective

Stop cross-facility PHI access. Every request is authorized by role, responsibility, and facility subtree before any data is returned or changed.

## Scope

- Central policy and scope modules.
- Enforcement on patients, visits, referrals, supervision, queue, facilities, sync, dashboards, and admin.
- Object-level checks and IDOR regression tests.

## Non-goals

- PostgreSQL row-level security in v1.
- Custom user-defined roles beyond the responsibility grants.

## Roles

ANM, CHO, HRP_HELPDESK_BLOCK, BHM, HRP_HELPDESK_DISTRICT, DHS. ASHA is not a
login role. MO, STATE_ADMIN, and DISTRICT_ADMIN are removed. See
`SPEC-matru-suraksha-roles-and-follow-up.md` for the binding hierarchy and
provisioning matrix.

## Functional requirements

- `FR-AUTHZ-001`: resolve the actor facility from the database on each request; do not trust the JWT facility claim indefinitely.
- `FR-AUTHZ-002`: visible when `target.path = actor.path OR target.path LIKE actor.path || '.%'`.
- `FR-AUTHZ-003`: query/body `facilityId` can only narrow the actor scope, never widen it.
- `FR-AUTHZ-004`: list queries apply scope before pagination and counts.
- `FR-AUTHZ-005`: by-id reads outside scope return 404; writes return 403.
- `FR-AUTHZ-006`: ANM writes only at own facility; CHO within HWC subtree; block helpdesk and BHM within the block subtree; district helpdesk and DHS are read-only on clinical records.
- `FR-AUTHZ-007`: BHM, block helpdesk, district helpdesk and DHS can read full patient records within scope; every read is audited.
- `FR-AUTHZ-008`: the retained referral API is visible to the actor's scope and to assigned `REFERRAL_NODAL` holders; the standalone referral workflow is superseded.
- `FR-AUTHZ-009`: `sync_queue` is scoped by `facility_id`; clients cannot push entities outside their scope.
- `FR-AUTHZ-010`: DHS admin actions are restricted to the district subtree.

## Interfaces

`packages/server/src/authz/policy.ts` exports permission decisions. `packages/server/src/authz/scope.ts` exports subtree predicates and scope resolution.

## Audit and privacy

Every denial emits `authz.denied`. Every in-scope patient read emits `patient.read`. Audit metadata excludes names, phones, and free text.

## Testing

- Role-by-action matrix tests for every route.
- IDOR tests: actor A cannot read/update/delete actor B's patient in another facility.
- Referral visibility tests for block and district nodal.
- Scope narrowing tests for query parameters.

## Success criteria

- Zero unscoped patient/visit/referral/queue queries.
- IDOR suite passes for all routes.
- Changed-line coverage >= 80%.

## Boundaries

Always: deny by default. Ask first: new responsibilities or role changes. Never: trust client-supplied facility scope.
