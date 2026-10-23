# SPEC-production-packaging

Status: Approved
Owner: Operations
Depends on: secrets-config, database-lifecycle

## Objective

Produce reproducible production images from a clean clone and serve the PWA and API from one origin.

## Scope

- Root-context multi-stage Dockerfiles for server and client.
- Same-origin Nginx proxy.
- Health, readiness, graceful shutdown, non-root runtime.
- Preview and production compose files.

## Non-goals

- Kubernetes manifests in v1.
- Multi-region deployment.

## Functional requirements

- `FR-PKG-001`: server and client images build from the repository root using the root lockfile and workspace packages.
- `FR-PKG-002`: runtime containers are non-root and contain production dependencies only.
- `FR-PKG-003`: `/health` is liveness; `/ready` checks database connectivity and migration version.
- `FR-PKG-004`: SIGTERM closes the Fastify server and database pool.
- `FR-PKG-005`: client and `/api` are same-origin; `VITE_API_URL` is a build argument.
- `FR-PKG-006`: images are tagged with the git SHA and carry health checks.
- `FR-PKG-007`: preview compose serves the real built SPA.

## Interfaces

Ports: client 80, server 3000. Health endpoints: `GET /health`, `GET /ready`.

## Audit and privacy

Images contain no `.env`, source maps, or test data. Nginx adds security headers and does not cache API responses.

## Testing

- Clean-clone Docker build for both images.
- Container smoke test: health, readiness, login page, `/api/auth/login`.
- `docker compose -f docker-compose.preview.yml config`.

## Success criteria

- `docker build` succeeds from a clean checkout.
- `/ready` fails when the database is unavailable.
- Graceful shutdown exit code is zero.

## Boundaries

Always: pin base images and tag releases. Ask first: changing ports or topology. Never: bake secrets into images.
