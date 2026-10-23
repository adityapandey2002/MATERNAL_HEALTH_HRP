# SPEC-district-dashboards

Status: Approved
Owner: Product + Frontend + Backend
Depends on: authz-facility-scope, referral-workflow

## Objective

Give ANM, CHO, BHM, and DHS the right operational view at the right level, with aggregate counts and authorized drill-down.

## Scope

- ANM own list.
- CHO HWC dashboard.
- BHM block dashboard.
- DHS district dashboard.
- Drill-down: block -> facility -> ANM -> patient.
- Aggregate HRP, risk, follow-ups, referrals, sync, and ANM activity.

## Non-goals

- Predictive analytics.
- Cross-district comparison.
- Public reporting.

## Functional requirements

- `FR-DASH-001`: every dashboard query is scoped server-side.
- `FR-DASH-002`: aggregates include total pregnancies, RED/AMBER/GREEN, overdue follow-ups, pending referrals, acknowledged referrals, and ANM sync status.
- `FR-DASH-003`: DHS can drill down block -> facility -> ANM -> patient; BHM can drill down facility -> ANM -> patient.
- `FR-DASH-004`: BHM/DHS patient drill-down shows the full record read-only.
- `FR-DASH-005`: every patient-level drill-down emits `patient.read`.
- `FR-DASH-006`: date-range filters are validated and bounded.
- `FR-DASH-007`: counts and patient lists use the same scope predicate.
- `FR-DASH-008`: empty/loading/error states are accessible.

## Testing

- Scope tests for each dashboard level.
- Aggregate correctness fixtures.
- Drill-down authorization tests.
- Audit assertions for patient-level views.
- Axe checks for dashboard pages.

## Success criteria

- DHS sees district totals and can reach an ANM and patient within scope.
- No cross-block or cross-district leakage.
- p95 dashboard API <= 300 ms at pilot load.

## Boundaries

Always: scope queries. Ask first: new metrics. Never: expose another district's data.
