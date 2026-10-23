# ADR-003: Authorization and Facility Scoping

Status: Accepted
Date: 2026-10-23
Owner: Backend + Security

## Context

Authentication exists, but most routes do not enforce role or facility scope. Any authenticated user can read, update, or delete any patient, and the sync queue is global.

## Decision

Use application-layer, deny-by-default authorization with four roles (ANM, CHO, BHM, DHS) plus responsibility grants.

- Roles map to facility levels: ANM VILLAGE/HSC, CHO HWC, BHM BLOCK/CHC, DHS DISTRICT.
- Facility visibility: `target.path = actor.path OR target.path LIKE actor.path || '.%'`.
- Reads outside scope return 404; writes outside scope return 403.
- Query/body `facilityId` may narrow but never widen scope.
- Referral visibility additionally uses `responsibilities` grants (`REFERRAL_NODAL`) at facility, block, or district scope.
- BHM and DHS read full patient records within scope, read-only, audited.
- DHS administers users, facilities, and responsibilities only inside the district.

## Alternatives considered

- PostgreSQL row-level security: stronger isolation, but adds policy duplication and operational complexity in v1.
- Role-only checks: insufficient because referral nodality is person-specific.
- Client-side filtering: rejected; never trusted.

## Consequences

- Every route needs a scope predicate and tests.
- `sync_queue` gains `facility_id`.
- Facility paths must use stable codes and a BLOCK level.
- JWT facility claims are advisory only; the actor facility is resolved from the database.

## Follow-up

Implement `SPEC-authz-facility-scope` and IDOR regression tests before any real patient data.
