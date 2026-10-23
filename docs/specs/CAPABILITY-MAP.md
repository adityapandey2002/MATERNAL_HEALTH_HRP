# Capability Map: HRP Araria Production Launch

Status: Approved
Owner: Architect / Tech Lead
Last reviewed: 2026-10-23

## Product decision

Four roles only: **ANM -> CHO -> BHM -> DHS**.
- ANM: VILLAGE/HSC.
- CHO: HWC.
- BHM: BLOCK/CHC.
- DHS: DISTRICT.
- ASHA remains patient contact data only; no login.
- MO, STATE_ADMIN, and DISTRICT_ADMIN are removed from the pilot model.
- BHM and DHS can read full patient records within scope, read-only; every view is audited.
- DHS administers users, facilities, and responsibilities only inside the district.
- Clinical referrals are acknowledged by CHO at HWC, BHM at CHC/block hospital, DHS at district hospital, or any user granted `REFERRAL_NODAL` through the admin panel.
- Block nodal sees all block referrals; district nodal sees all district referrals.
- Dashboards provide aggregate counts plus drill-down to facility, ANM, and patient.

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
| 10 | `district-administration` | DHS admin UI for users, facilities, responsibilities, audit | `authz-facility-scope`, `phi-audit`, `district-onboarding` |
| 11 | `referral-workflow` | Clinical referral state machine and nodal visibility | `authz-facility-scope`, `district-administration`, `phi-audit` |
| 12 | `district-dashboards` | Aggregate dashboards with scoped drill-down | `authz-facility-scope`, `referral-workflow` |
| 13 | `consent-retention` | Consent capture, retention, erasure, data-subject requests | `authz-facility-scope`, `phi-audit` |
| 14 | `i18n-a11y` | Hindi/English catalogs and WCAG 2.1 AA | `pwa-privacy` |
| 15 | `e2e-load` | Offline, referral, supervision E2E and load evidence | `authz-facility-scope`, `pwa-privacy`, `observability`, `referral-workflow`, `district-dashboards` |
| 16 | `cicd-release` | Build once, migration job, deploy, rollback, threshold gates | `production-packaging`, `e2e-load`, `observability` |
| 17 | `compliance-docs` | DPDP/DPIA, notices, ROPA, breach plan, runbooks | `phi-audit`, `pwa-privacy`, `consent-retention` |

## Facility model

```text
STATE -> DISTRICT -> BLOCK -> CHC/PHC -> HWC -> VILLAGE/HSC
```

- BHM is assigned to the BLOCK node.
- `facilities.path` uses stable codes.
- Scope predicate: `target.path = actor.path OR target.path LIKE actor.path || '.%'`.
- Referral destinations are HWC, CHC/block hospital, district hospital, or a facility with an assigned `REFERRAL_NODAL`.

## Role permission summary

| Action | ANM | CHO | BHM | DHS |
|---|---|---|---|---|
| Patient read | own | HWC subtree | block subtree | district subtree |
| Patient create/update | own | HWC subtree | no | no |
| Patient archive | no | no | no | audited admin flow |
| Visit create/update | own | HWC subtree | no | no |
| Referral create | own | HWC subtree | no | no |
| Referral read | own outbound | HWC | all block | all district |
| Referral acknowledge | no | HWC destination | CHC/block destination | district hospital |
| Dashboard | own | HWC | block | district |
| User/facility/responsibility admin | no | no | no | district |
| Audit read | no | no | no | district |

Additional grants are expressed as responsibilities, not new roles. `REFERRAL_NODAL` can be assigned at facility, block, or district scope.

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
