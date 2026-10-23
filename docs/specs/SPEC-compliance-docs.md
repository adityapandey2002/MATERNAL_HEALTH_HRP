# SPEC-compliance-docs

Status: Approved
Owner: DPO + Product + Security
Depends on: phi-audit, pwa-privacy, consent-retention

## Objective

Produce the evidence and procedures required to process district maternal health data lawfully and operate the system safely.

## Scope

- DPIA, ROPA, consent notices, retention policy.
- Breach notification matrix and tabletop.
- ADRs and runbooks.
- Launch checklist and go/no-go.

## Non-goals

- Legal representation.
- ABDM certification in v1.

## Functional requirements

- `FR-COMP-001`: DPIA covers data flows, purposes, roles, risks, and mitigations.
- `FR-COMP-002`: ROPA lists every PHI field, purpose, retention, and access role.
- `FR-COMP-003`: Hindi and English consent notices are approved.
- `FR-COMP-004`: breach matrix names who notifies whom and within what time.
- `FR-COMP-005`: data-subject request and access-review procedures exist.
- `FR-COMP-006`: vendor/DPA checklist covers hosting, backups, monitoring, and support.
- `FR-COMP-007`: runbooks cover deploy, rollback, restore, incident, provisioning, transfer, device loss, and paper fallback.
- `FR-COMP-008`: launch checklist and go/no-go require signed evidence.
- `FR-COMP-009`: ADRs record hosting, authz, audit, migrations, deployment, retention, i18n, secrets, PWA, observability, DR, release, identity, API security, accessibility, and Araria master.

## Testing

- Documentation review checklist.
- Breach tabletop.
- Restore/rollback runbook dry-run.
- No PHI or secrets in docs scan.

## Success criteria

- DPO and district sign off.
- Every launch checklist item has owner and evidence.
- Runbooks tested within 30 days of launch.

## Boundaries

Always: classify docs. Ask first: policy changes. Never: include PHI or secrets in documentation.
