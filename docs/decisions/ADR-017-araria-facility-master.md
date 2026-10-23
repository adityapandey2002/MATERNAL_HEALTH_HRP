# ADR-017: Araria Facility Master

Status: Accepted
Date: 2026-10-23
Owner: Product + District Coordinator

## Context

Seed data models Gujarat/Ahmedabad. The product is branded for Araria, Bihar, and the launch requires the real district hierarchy and users.

## Decision

- Replace demo seed with an Araria onboarding import.
- Facility tree: STATE -> DISTRICT -> BLOCK -> CHC/PHC -> HWC -> VILLAGE/HSC.
- BHM is assigned to the BLOCK node.
- Paths use stable facility codes, not display names.
- User roster includes employee ID, name, phone, role, facility, and language.
- ASHA remains contact data on the patient record, not a login role.
- No default passwords; one-time credentials force a change.
- Bulk import is idempotent, validated, dry-run capable, and reversible.

## Alternatives considered

- Keep demo data and edit manually: error-prone and unauditable.
- Use display names in paths: breaks on rename.

## Consequences

- A district-validated facility and user roster is required before pilot.
- Existing databases need a backfill migration.
- Block-level scope depends on the new BLOCK node.

## Follow-up

Implement `SPEC-district-onboarding` and `SPEC-district-administration` in Wave 3.
