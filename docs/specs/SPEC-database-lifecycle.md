# SPEC-database-lifecycle

Status: Approved
Owner: Backend + Operations
Depends on: secrets-config

## Objective

Make schema changes versioned, reversible, and safe to run before every deployment. Prevent accidental destruction of production data.

## Scope

- Ordered migrations with a ledger, checksums, and advisory lock.
- Seed guard.
- Scope indexes, including `sync_queue.facility_id`.
- Backup and restore procedure.

## Non-goals

- Online zero-downtime migrations for every table in v1; expand/contract is required.

## Functional requirements

- `FR-DB-001`: migrations live in `packages/server/migrations/` and are applied in order.
- `FR-DB-002`: a migration ledger stores id, checksum, and applied timestamp; checksum drift fails.
- `FR-DB-003`: migrations run in a transaction and acquire an advisory lock.
- `FR-DB-004`: `seed.ts` aborts when `NODE_ENV=production` unless an explicit allow flag is set.
- `FR-DB-005`: add `sync_queue.facility_id`, `facilities.path` text pattern index, and scope/updated-at indexes.
- `FR-DB-006`: add `BLOCK` facility level support and stable-code paths.
- `FR-DB-007`: backup/restore runbook and automated backup verification exist.

## Interfaces

Tables: `schema_migrations`, `facilities`, `users`, `patients`, `visits`, `referrals`, `sync_queue`, `supervision_alerts`, `audit_events`, `responsibilities`, `consent_records`.

## Audit and privacy

Migration logs contain migration names and durations only. Backups are encrypted and access-controlled.

## Testing

- Migration idempotency test against a fresh PostgreSQL database.
- Checksum-drift failure test.
- Seed guard test.
- Restore drill in staging.

## Success criteria

- Re-running migrations is a no-op.
- Production seed is impossible without explicit approval.
- Backup restore verified before pilot.

## Boundaries

Always: backup before destructive migrations. Ask first: dropping columns or tables. Never: run seed in production.
