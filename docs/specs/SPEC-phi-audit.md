# SPEC-phi-audit

Status: Approved
Owner: Security + DPO
Depends on: authz-facility-scope

## Objective

Create an append-only record of who accessed or changed PHI, when, from where, and under which responsibility.

## Scope

- `audit_events` table and writer.
- Event coverage for auth, patient, visit, referral, alert, sync, export, admin, and denial.
- District-scoped audit reader for DHS.
- Hash chain and retention.

## Non-goals

- Full SIEM integration in v1.
- Storing clinical values in audit metadata.

## Functional requirements

- `FR-AUDIT-001`: schema includes id, occurred_at, actor_user_id, actor_role, actor_facility_id, action, entity_type, entity_id, patient_id, facility_id, outcome, request_id, ip_hash, user_agent, metadata, before_digest, after_digest, prev_hash, hash.
- `FR-AUDIT-002`: clinical writes and their audit row commit atomically.
- `FR-AUDIT-003`: patient reads by BHM/DHS and all referral views emit events.
- `FR-AUDIT-004`: denials emit `authz.denied` with route and target type.
- `FR-AUDIT-005`: audit rows are insert-only; updates and deletes are denied at the database role level.
- `FR-AUDIT-006`: hash chain detects tampering; daily anchor to immutable storage.
- `FR-AUDIT-007`: DHS audit reader is district-scoped and read-only.
- `FR-AUDIT-008`: metadata is non-PHI and documented per action.

## Testing

- Every sensitive route emits exactly one success or denial event.
- Tamper test fails on modified row.
- Transaction rollback removes the audit row with the clinical write.
- DHS cannot read another district's audit.

## Success criteria

- Audit completeness checklist passes for all routes.
- No patient name, phone, ABHA, or free text in metadata.
- Retention/purge job tested.

## Boundaries

Always: audit access and changes. Ask first: new audit event types. Never: store PHI in audit metadata.
