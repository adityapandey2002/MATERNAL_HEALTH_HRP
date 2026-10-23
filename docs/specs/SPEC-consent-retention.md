# SPEC-consent-retention

Status: Approved
Owner: DPO + Clinical + Backend
Depends on: authz-facility-scope, phi-audit

## Objective

Capture informed consent for processing maternal health data and enforce retention, erasure, and data-subject request handling.

## Scope

- Consent notice in Hindi and English.
- Consent record version, timestamp, language, and method.
- Retention configuration and purge job.
- Data-subject request workflow.
- DPIA inputs.

## Non-goals

- Automated legal advice.
- Aadhaar-based consent.

## Functional requirements

- `FR-CONSENT-001`: patient registration displays the approved notice and records consent.
- `FR-CONSENT-002`: consent records store version, language, timestamp, actor, and patient.
- `FR-CONSENT-003`: consent can be withdrawn; withdrawal is audited and flagged.
- `FR-CONSENT-004`: retention periods are configuration-driven and approved by the DPO.
- `FR-CONSENT-005`: purge/erasure job is idempotent, audited, and excludes records under legal hold.
- `FR-CONSENT-006`: data-subject request runbook covers access, correction, and erasure.
- `FR-CONSENT-007`: no Aadhaar numbers are collected or stored in v1.

## Testing

- Consent capture and versioning tests.
- Withdrawal flag test.
- Retention job dry-run and execution tests.
- Erasure requires authorization and emits audit events.

## Success criteria

- Every new patient has a consent record.
- Purge job produces an auditable report.
- DPO signs off on notice, retention, and erasure procedure.

## Boundaries

Always: record consent version. Ask first: retention periods. Never: collect Aadhaar or use consent for unrelated purposes.
