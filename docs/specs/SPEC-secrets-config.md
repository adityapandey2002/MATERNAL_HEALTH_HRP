# SPEC-secrets-config

Status: Approved
Owner: Security + Backend
Depends on: none

## Objective

Make configuration explicit and fail closed. Production must never start with a default JWT secret, wildcard CORS, or missing database credentials.

## Scope

- One server configuration module reading `process.env`.
- One build-time client configuration check.
- `.env.example` documenting every variable without values.
- Startup validation with aggregated errors.

## Non-goals

- Secret rotation automation.
- Cloud secrets-manager integration code beyond reading injected env.

## Functional requirements

- `FR-CONFIG-001`: `packages/server/src/config.ts` validates `NODE_ENV`, `PORT`, `HOST`, `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, access/refresh TTLs, `CORS_ORIGINS`, `COOKIE_SECURE`, `TRUST_PROXY`, pool size, rate limits, and log level.
- `FR-CONFIG-002`: Production rejects a missing/short `JWT_SECRET`, known development values, identical access/refresh secrets, and wildcard origins.
- `FR-CONFIG-003`: Errors list variable names, never values.
- `FR-CONFIG-004`: `index.ts`, `routes/auth.ts`, and `db/client.ts` import config instead of reading `process.env`.
- `FR-CONFIG-005`: `packages/client/vite.config.ts` validates `VITE_API_URL` and build metadata.
- `FR-CONFIG-006`: `.env.example` is committed with placeholders; `.env` remains ignored.

## Interfaces

Required keys: `NODE_ENV`, `PORT`, `HOST`, `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_TTL`, `JWT_REFRESH_TTL`, `CORS_ORIGINS`, `COOKIE_SECURE`, `TRUST_PROXY`, `DB_POOL_MAX`, `RATE_LIMIT_AUTH`, `RATE_LIMIT_API`, `LOG_LEVEL`, `APP_VERSION`, `GIT_SHA`.

## Audit and privacy

Config validation logs names and outcomes only. Secrets are never serialized.

## Testing

- Unit tests for valid/invalid config, defaults in development, production rejection.
- Integration test that server boot fails with an invalid environment.

## Success criteria

- Server refuses production startup without strong secrets.
- No `process.env` reads outside `config.ts` (except tests and scripts).
- `npm run check:fast` passes.

## Boundaries

Always: validate at boot. Ask first: new required variables. Never: log or commit secret values.
