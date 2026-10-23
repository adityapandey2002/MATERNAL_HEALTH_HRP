# SPEC-observability

Status: Approved
Owner: Operations
Depends on: secrets-config, phi-audit

## Objective

Make production behavior visible without leaking PHI, and give operators actionable alerts.

## Scope

- Structured logs with redaction.
- Readiness checks, metrics, traces, dashboards, alerts, SLOs.
- Sync backlog and auth-failure monitoring.

## Non-goals

- Full APM vendor selection.
- Patient-level analytics in operational telemetry.

## Functional requirements

- `FR-OBS-001`: JSON logs include request id, route, status, duration, and actor role; never names, phones, ABHA, or free text.
- `FR-OBS-002`: `/ready` checks database connectivity and migration version.
- `FR-OBS-003`: metrics cover p95 latency, 5xx rate, auth failures, sync backlog, conflicts, and queue retries.
- `FR-OBS-004`: alerts fire on API down, 5xx > 2%, DB disk > 80%, backup failure, sync backlog, and migration mismatch.
- `FR-OBS-005`: trace context propagates through API and database calls.
- `FR-OBS-006`: SLOs and on-call escalation are documented.
- `FR-OBS-007`: dashboards are district/block scoped for product use, separate from operational telemetry.

## Testing

- Log-redaction unit test with a patient name and phone.
- Readiness test with database down.
- Alert rule tests with synthetic metrics.
- Trace propagation smoke test.

## Success criteria

- No PHI in logs.
- Alerts fire within 5 minutes in staging.
- Operators can diagnose a failed sync from dashboards.

## Boundaries

Always: redact. Ask first: new telemetry fields. Never: send PHI to third-party analytics.
