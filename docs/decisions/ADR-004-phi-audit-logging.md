# ADR-004: PHI Audit Logging

Status: Accepted
Date: 2026-10-23
Owner: Security + DPO

## Context

The MVP requires an audit log, but no audit table or event emission exists. Cross-facility access and BHM/DHS patient drill-down increase the need for accountability.

## Decision

Add an append-only `audit_events` table with a hash chain.

Fields: id, occurred_at, actor_user_id, actor_role, actor_facility_id, action, entity_type, entity_id, patient_id, facility_id, outcome, request_id, ip_hash, user_agent, metadata, before_digest, after_digest, prev_hash, hash.

- Clinical writes and their audit row commit in the same transaction.
- Patient reads by BHM/DHS, referral views, exports, admin changes, and denials are audited.
- Metadata excludes names, phones, ABHA, and free text.
- Audit rows are insert-only at the database role level.
- DHS has a read-only, district-scoped audit viewer.

## Alternatives considered

- Application log only: not tamper-evident or queryable.
- Full event sourcing: too heavy for v1.

## Consequences

- Slight write overhead.
- Retention and purge policy required.
- Daily hash anchoring needed for tamper evidence.

## Follow-up

Implement `SPEC-phi-audit` in Wave 1.
