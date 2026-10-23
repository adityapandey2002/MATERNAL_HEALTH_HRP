# Backup and Restore Runbook

Owner: Operations
Last reviewed: 2026-10-23
Review cadence: monthly restore drill, quarterly access review

## Targets

| Target | Value |
|---|---|
| RPO | 15 minutes (managed PostgreSQL PITR) |
| RTO | 4 hours |
| Retention | 35 days daily, 12 months monthly |
| Encryption | Provider-managed at rest plus age/GPG for exported dumps |
| Access | Operations role only; break-glass approval for restore |

## Before every destructive migration

1. Confirm the deployment is in a maintenance window.
2. Take an on-demand snapshot.
3. Export a logical backup:

```powershell
$env:PGPASSWORD = $env:HRP_DB_PASSWORD
pg_dump --format=custom --no-owner --no-privileges `
  --file "hrp-$(Get-Date -Format yyyyMMdd-HHmmss).dump" $env:DATABASE_URL
```

4. Encrypt and upload:

```powershell
age --encrypt --recipient $env:BACKUP_AGE_RECIPIENT `
  --output "$env:BACKUP_FILE.age" $env:BACKUP_FILE
```

5. Record the SHA-256 checksum in the change ticket.
6. Run the archive check before the migration:

```powershell
$env:BACKUP_FILE = "C:\backups\hrp-20261023-120000.dump"
npm run backup:verify
```

## Restore drill (monthly)

Use an isolated database. Never restore over production.

```powershell
$env:RESTORE_DATABASE_URL = "postgresql://hrp:...@restore-db:5432/hrp_restore"
$env:ALLOW_RESTORE_DRILL = "true"
$env:BACKUP_FILE = "C:\backups\hrp-20261023-120000.dump"
npm run backup:verify
```

The script checks the archive TOC, restores with `--clean --if-exists`, and runs a row-count smoke query. Record the result and duration in the operations log.

## Production restore

1. Declare an incident and obtain DHS/operations approval.
2. Stop API traffic at the load balancer. Do not stop the database.
3. Restore to a new instance, never over the live instance.
4. Point the API at the restored instance and run `npm run db:migrate`.
5. Verify `/ready`, login, patient count, referral count, and audit append.
6. Resume traffic gradually and monitor errors.
7. Preserve the failed instance for investigation.

## Verification checklist

- [ ] Snapshot or dump completed and checksum recorded.
- [ ] `npm run backup:verify` passed.
- [ ] Restore drill completed in the last 30 days.
- [ ] Restore database was isolated and then destroyed.
- [ ] No PHI was written to tickets, logs, or chat.
- [ ] RPO/RTO result recorded.

## Failure handling

- Archive unreadable: use the previous daily backup and open a provider ticket.
- Restore slower than RTO: escalate to the provider and incident commander.
- Checksum mismatch: treat as corruption; do not restore.
- Suspected credential exposure: rotate backup credentials before retrying.
