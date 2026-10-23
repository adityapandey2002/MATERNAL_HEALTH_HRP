# SPEC-cicd-release

Status: Approved
Owner: Operations
Depends on: production-packaging, e2e-load, observability

## Objective

Ship changes through enforced gates, build once, deploy the same artifact to staging and production, and roll back safely.

## Scope

- CI quality gates, E2E, security scanning.
- Image build and registry.
- Staging and production deploy workflows.
- Migration job, smoke tests, rollback.

## Non-goals

- Multi-cloud deployment.
- Fully automated production approval.

## Functional requirements

- `FR-CICD-001`: PR runs fast, task, full, E2E, and preview gates.
- `FR-CICD-002`: Lighthouse, axe, and bundle size failures block merge.
- `FR-CICD-003`: images are built once, scanned, and promoted by digest.
- `FR-CICD-004`: migrations run as a one-off pre-deploy job with lock and backup.
- `FR-CICD-005`: staging deploys automatically from main; production requires environment approval.
- `FR-CICD-006`: smoke tests gate promotion.
- `FR-CICD-007`: rollback workflow re-promotes the previous digest and alerts.
- `FR-CICD-008`: production secrets live in environment secrets, not code.
- `FR-CICD-009`: Dependabot and dependency audit run weekly.
- `FR-CICD-010`: branch protection requires checks and review.

## Testing

- Workflow dry-run on a branch.
- Staging deploy and smoke test.
- Rollback rehearsal.
- Migration job failure path.

## Success criteria

- CI under 10 minutes for fast/task/full.
- Production deploy and rollback both rehearsed.
- No deploy bypasses gates.

## Boundaries

Always: sign releases. Ask first: CI/CD changes. Never: deploy from a laptop or skip gates.
