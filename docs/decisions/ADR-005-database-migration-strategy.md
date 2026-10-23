# ADR-005: Database Migration Strategy

Status: Accepted
Date: 2026-10-23
Owner: Backend + Operations

## Context

Schema is created by an idempotent runtime script. There is no version ledger, checksum, rollback, or protection against running seed in production.

## Decision

Use ordered SQL migrations with a ledger.

- `packages/server/migrations/NNN_description.sql`.
- `schema_migrations` stores id, checksum, applied_at.
- Migrations acquire an advisory lock and run in a transaction.
- Checksum drift fails the run.
- Expand/contract for destructive changes; application must remain compatible with N-1.
- `seed.ts` aborts in production unless an explicit allow flag is set.
- Migrations run as a one-off deployment job, never on application startup.

## Alternatives considered

- Kysely migrator: viable, but SQL files are easier to review and operate.
- Prisma: adds a new ORM and migration tool for no v1 benefit.

## Consequences

- Existing schema must be baselined as migration 001.
- Every schema change requires a migration and backup.
- Rollback is application-first, then forward-fix; restore is last resort.

## Follow-up

Implement `SPEC-database-lifecycle` in Wave 0.
