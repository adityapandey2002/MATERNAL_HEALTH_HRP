# Capability Map: Matru Suraksha Araria Production Launch

Status: Approved
Owner: Architect / Tech Lead
Last reviewed: 2026-10-30

## Product decision

Six roles in the final hierarchy:

```
ANM -> CHO -> HRP_HELPDESK_BLOCK -> BHM -> HRP_HELPDESK_DISTRICT -> DHS
```

- ANM: VILLAGE/HSC/HWC.
- CHO: HWC/PHC/CHC.
- HRP_HELPDESK_BLOCK: BLOCK/CHC.
- BHM: BLOCK/CHC.
- HRP_HELPDESK_DISTRICT: DISTRICT.
- DHS: DISTRICT.
- ASHA remains patient contact data only; no login.
- MO and STATE_ADMIN/DISTRICT_ADMIN are removed from the pilot model.
- BHM and DHS can read full patient records within scope; every view is audited.
- Account creation is delegated: DHS creates BHM and district helpdesk accounts;
  BHM creates ANM, CHO and block helpdesk accounts.
- HRP follow-up is a repeating 15-day cycle. A referred HRP starts with the
  block helpdesk; completion starts the next field cycle for ANM/CHO with block
  visibility. An overdue cycle escalates to DHS.
- The standalone referral workflow is superseded by the block-owned first
  follow-up. Clinical referral notes stay on visits.
- Dashboards provide aggregate counts plus drill-down to facility, block, and
  patient.

See `SPEC-matru-suraksha-roles-and-follow-up.md` for the binding rules; it
supersedes the role, referral and dashboard rows below where they differ.

## Modules

| Order | Module id | Responsibility | Depends on |
|---:|---|---|---|
| 1 | `secrets-config` | Typed fail-fast runtime and build configuration | - |
| 2 | `database-lifecycle` | Versioned migrations, seed guards, indexes, backups | `secrets-config` |
| 3 | `production-packaging` | Reproducible images, same-origin deployment, health and shutdown | `secrets-config`, `database-lifecycle` |
| 4 | `authz-facility-scope` | Role and responsibility policy, facility subtree scope | `secrets-config`, `database-lifecycle` |
| 5 | `phi-audit` | Append-only audit trail for PHI access and changes | `authz-facility-scope` |
| 6 | `web-security` | CORS, CSRF, rate limits, headers, session revocation | `secrets-config`, `authz-facility-scope` |
| 7 | `pwa-privacy` | No PHI in caches, logout wipe, device-loss safeguards | `authz-facility-scope`, `web-security` |
| 8 | `observability` | Redacted logs, metrics, readiness, alerts, SLOs | `secrets-config`, `phi-audit` |
| 9 | `district-onboarding` | Araria facility and user import, path validation | `database-lifecycle`, `authz-facility-scope` |
| 10 | `district-administration` | Delegated provisioning: DHS creates BHM/district helpdesk, BHM creates ANM/CHO/block helpdesk | `authz-facility-scope`, `phi-audit`, `district-onboarding` |
| 11 | `referral-workflow` | Superseded: clinical referral notes stay on visits; the block-owned first 15-day cycle replaces the workflow | `authz-facility-scope`, `district-administration`, `phi-audit` |
| 12 | `district-dashboards` | Block and district dashboards with scoped drill-down and the 15-day escalation queue | `authz-facility-scope` |
| 13 | `consent-retention` | Consent capture, retention, erasure, data-subject requests | `authz-facility-scope`, `phi-audit` |
| 14 | `i18n-a11y` | Hindi/English catalogs and WCAG 2.1 AA | `pwa-privacy` |
| 15 | `e2e-load` | Offline sync, 15-day cycle, supervision E2E and load evidence | `authz-facility-scope`, `pwa-privacy`, `observability`, `district-dashboards` |
| 16 | `cicd-release` | Build once, migration job, deploy, rollback, threshold gates | `production-packaging`, `e2e-load`, `observability` |
| 17 | `compliance-docs` | DPDP/DPIA, notices, ROPA, breach plan, runbooks | `phi-audit`, `pwa-privacy`, `consent-retention` |

## Facility model

```text
STATE -> DISTRICT -> BLOCK -> CHC/PHC -> HWC -> VILLAGE/HSC
```

- BHM and HRP_HELPDESK_BLOCK are assigned to the BLOCK node; the district helpdesk and DHS to the DISTRICT node.
- `facilities.path` uses stable codes.
- Scope predicate: `target.path = actor.path OR target.path LIKE actor.path || '.%'`.
- Follow-up ownership is resolved inside the facility subtree; clinical referral notes stay on visits.

## Role permission summary

| Action | ANM | CHO | HRP_HELPDESK_BLOCK | BHM | HRP_HELPDESK_DISTRICT | DHS |
|---|---|---|---|---|---|---|
| Patient read | own | HWC subtree | block subtree | block subtree | district subtree | district subtree |
| Patient create/update | own | HWC subtree | block subtree | block subtree | no | no |
| Visit create/update | own | HWC subtree | block subtree | block subtree | no | no |
| Follow-up close | own | HWC subtree | block subtree | block subtree | district subtree | district subtree |
| Block dispatch | no | no | block subtree | block subtree | no | no |
| Dashboard | own | HWC | block | block | district | district |
| Account provisioning | no | no | no | ANM/CHO/block helpdesk | no | BHM/district helpdesk |
| Audit read / district admin | no | no | no | no | no | district subtree |

`REFERRAL_NODAL` remains a legacy responsibility grant for the retained referral API; it does not add a role.

## Build order

`secrets-config` -> `database-lifecycle` -> `production-packaging` -> `authz-facility-scope` -> `phi-audit` -> `web-security` -> `pwa-privacy` -> `observability` -> `district-onboarding` -> `district-administration` -> `referral-workflow` -> `district-dashboards` -> `consent-retention` -> `i18n-a11y` -> `e2e-load` -> `cicd-release` -> `compliance-docs`

## Definition of done

- All 17 specs implemented.
- `npm run check:full` passes.
- Authorization and IDOR suites pass.
- No PHI in caches, logs, or docs.
- E2E and load evidence attached.
- Backup restore and rollback rehearsed.
- DPIA, consent, retention, and district approvals complete.
- Go/no-go signed by product, tech, security, DPO, clinical, and district.
