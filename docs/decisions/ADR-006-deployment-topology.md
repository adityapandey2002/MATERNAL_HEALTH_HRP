# ADR-006: Deployment Topology

Status: Accepted
Date: 2026-10-23
Owner: Operations

## Context

The current preview compose builds package subdirectories that cannot resolve the root workspace or shared package. Production deployment is described in the README but not implemented.

## Decision

Deploy a same-origin container topology.

- DNS/TLS/WAF/CDN in front.
- Nginx serves the built PWA and proxies `/api` to Fastify.
- Two or more stateless API containers behind a load balancer.
- Managed PostgreSQL 16 with private networking and PITR.
- One-shot migration job before rollout.
- Secrets injected from a secrets manager.
- Staging mirrors production with synthetic data.
- Build once, promote the same image digest.

## Alternatives considered

- Netlify frontend + separate API: cross-origin cookies and split configuration add risk.
- Single VM for production: acceptable only for a short demo, not PHI.

## Consequences

- Root-context Dockerfiles are required.
- Client `VITE_API_URL` is a build argument.
- Health/readiness and graceful shutdown are required.
- Hosting provider remains an open decision (ADR-002).

## Follow-up

Implement `SPEC-production-packaging` in Wave 0 and `SPEC-cicd-release` in Wave 5.
