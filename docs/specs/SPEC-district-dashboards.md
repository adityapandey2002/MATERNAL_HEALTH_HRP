# SPEC-district-dashboards

Status: Approved
Owner: Product + Frontend + Backend
Depends on: authz-facility-scope, matru-suraksha-roles-and-follow-up

## Objective

Give ANM, CHO, the block helpdesk, BHM, the district helpdesk and DHS the right operational view at the right level, with aggregate counts and authorized drill-down.

## Scope

- ANM own list.
- CHO HWC dashboard.
- Block HRP Helpdesk and BHM block dashboard with the dispatch box.
- District HRP Helpdesk and DHS district dashboard with the escalation queue.
- Drill-down: block -> facility -> ANM -> patient.
- Aggregate HRP, risk, 15-day follow-up stage, escalations and ANM sync activity.

## Non-goals

- Predictive analytics.
- Cross-district comparison.
- Public reporting.

## Functional requirements

- `FR-DASH-001`: every dashboard query is scoped server-side.
- `FR-DASH-002`: aggregates include total HRPs, RED/AMBER/GREEN, block-stage pending, field-stage pending, escalated/overdue cycles, compliance, and ANM sync status.
- `FR-DASH-003`: DHS and the district helpdesk can drill down block -> facility -> ANM -> patient; BHM and the block helpdesk can drill down facility -> ANM -> patient.
- `FR-DASH-004`: BHM/DHS patient drill-down shows the full record read-only.
- `FR-DASH-005`: every patient-level drill-down emits `patient.read`.
- `FR-DASH-006`: date-range filters are validated and bounded.
- `FR-DASH-007`: counts and patient lists use the same scope predicate.
- `FR-DASH-008`: empty/loading/error states are accessible.
- `FR-DASH-009`: escalation is derived from `status = PENDING OR NOT_REACHABLE` with `scheduled_date < today`; no stored escalation flag.

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
