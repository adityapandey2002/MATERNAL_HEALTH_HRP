# ADR-009: Secrets and Configuration

Status: Accepted
Date: 2026-10-23
Owner: Security

## Context

The server falls back to a development JWT secret, CORS reflects any origin with credentials, and configuration is read ad hoc from `process.env`.

## Decision

One typed configuration module validates the environment at boot and fails closed.

- Production rejects missing or weak `JWT_SECRET`, known dev values, identical refresh secret, and wildcard CORS.
- Separate access and refresh secrets.
- Errors list variable names, never values.
- `.env.example` contains placeholders only.
- Client build validates `VITE_API_URL` and build metadata.
- Secrets are injected by the platform, never baked into images or docs.

## Alternatives considered

- Per-module env reads: scattered and easy to misconfigure.
- Runtime config endpoint: exposes configuration and complicates caching.

## Consequences

- Server cannot start with an incomplete production environment.
- Tests must construct config explicitly.
- CI and staging need their own secrets.

## Follow-up

Implement `SPEC-secrets-config` in Wave 0.
