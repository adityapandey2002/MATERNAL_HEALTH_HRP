# Matru Suraksha — Maintenance & Troubleshooting Guide

This guide provides operational runbooks, diagnostic procedures, and troubleshooting steps for system administrators, DevOps engineers, and support personnel maintaining the **Matru Suraksha** platform.

---

## 1. Routine Maintenance Procedures

### 1.1 Database Backups & Restores

#### Automated Daily Backup via `pg_dump`
```bash
# Capture full database schema and data in compressed format
pg_dump --host=localhost --port=5432 --username=hrp_admin --format=custom --blobs \
  --file=/var/backups/matru_suraksha_$(date +%Y%m%d_%H%M%S).dump hrp_db
```

#### Restoring from Backup
```bash
# Terminate existing connections before restoring
psql -U hrp_admin -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'hrp_db' AND pid <> pg_backend_pid();"

# Restore database
pg_restore --clean --if-exists --no-owner --no-privileges \
  --host=localhost --port=5432 --username=hrp_admin --dbname=hrp_db \
  /var/backups/matru_suraksha_YYYYMMDD_HHMMSS.dump
```

### 1.2 Database Maintenance & Index Hygiene

PostgreSQL requires periodic vacuuming and index analysis to maintain optimal query performance on high-volume tables (`visits`, `patients`, `follow_up_tasks`):

```sql
-- Analyze table statistics for Kysely query planning
ANALYZE patients;
ANALYZE visits;
ANALYZE follow_up_tasks;
ANALYZE audit_logs;

-- Reclaim storage on heavily updated tables
VACUUM (VERBOSE, ANALYZE) follow_up_tasks;
VACUUM (VERBOSE, ANALYZE) sync_events;
```

---

## 2. Troubleshooting Runbooks

### Runbook 1: Migration Stalled on Advisory Lock `727001`

**Symptoms:** Running `npm run db:migrate` hangs indefinitely without logging progress.

**Root Cause:**
Kysely migration runner acquires PostgreSQL session-level advisory lock `727001` to prevent concurrent migration execution. If a previous migration process was abruptly killed (SIGKILL / container crash), the lock may remain held.

**Diagnostic Query:**
```sql
SELECT
  pid,
  locktype,
  classid,
  objid,
  mode,
  granted
FROM pg_locks
WHERE locktype = 'advisory' AND objid = 727001;
```

**Resolution:**
```sql
-- Terminate the blocking backend PID
SELECT pg_terminate_backend(<blocking_pid>);

-- Verify lock release
SELECT pg_advisory_unlock(727001);
```
Re-run migrations:
```bash
npm run db:migrate
```

---

### Runbook 2: Resolving Client Offline Sync Conflicts

**Symptoms:**
- Frontline ANM/CHO tablet indicates unsynced changes in the status header.
- Status displays `SYNC_ERROR` or repeated 409 Conflict / 400 Bad Request responses.

**Diagnosis:**
1. Open Chrome DevTools on the tablet (via USB debugging `chrome://inspect`).
2. Navigate to **Application** $\rightarrow$ **IndexedDB** $\rightarrow$ `hrp_db` $\rightarrow$ `syncQueue`.
3. Filter entries where `status === 'FAILED'` or `retries >= 5`.
4. Inspect the `lastError` attribute for the exact failure reason.

**Common Causes & Fixes:**
- **Device Revoked or Pending Approval:**
  - *Cause:* `POST /api/sync` returns HTTP 403 Forbidden with `{ code: "DEVICE_UNAUTHORIZED" }`.
  - *Fix:* District Admin must navigate to `/admin/devices` and click **Approve Device** for the tablet's fingerprint.
- **Concurrent Field Update (Conflict):**
  - *Cause:* An ANM and a CHO updated the same patient visit record simultaneously.
  - *Fix:* The server follows "last-write-wins" on demographic fields and appends chronological visits. In the event of an unresolvable conflict, trigger manual retry via the **Sync Center** screen:
    ```typescript
    await clientSyncEngine.retryFailedRecords();
    ```

---

### Runbook 3: Client In-Memory Crypto Key Lockout

**Symptoms:**
- User attempts to view patient details and receives: `"Encryption key not initialized. Please unlock device."`

**Root Cause:**
The 5-minute inactivity timer elapsed, or the user closed and reopened the application. For data protection, the derived AES-256-GCM Device Encryption Key (DEK) is strictly kept in volatile memory and cleared on lock.

**Resolution:**
1. Direct the healthcare worker to enter their 6-digit PIN on the prompt.
2. The client executes PBKDF2 (600,000 iterations) with the local salt to re-derive the DEK.
3. Decryption resumes instantly.

**Brute-Force Lockout (10 Failed Attempts):**
- If an unauthorized party or confused user enters the wrong PIN 10 consecutive times, the client executes an emergency wipe of local IndexedDB tables.
- **Recovery:** The legitimate staff member must reconnect to cellular/Wi-Fi and log in using their primary email and password. The system will re-authenticate, download the facility's active cohort, and prompt the user to set a fresh PIN.

---

### Runbook 4: Port Conflicts During Local Development

**Symptoms:**
- `Error: listen EADDRINUSE: address already in use :::3000` or `:::5173`.

**Resolution (Windows PowerShell):**
```powershell
# Identify process listening on port 3000
netstat -ano | findstr :3000

# Terminate process by PID
taskkill /F /PID <process_id>

# Identify process listening on port 5173
netstat -ano | findstr :5173
taskkill /F /PID <process_id>
```

---

### Runbook 5: Database Connection Pool Exhaustion

**Symptoms:**
- Server logs show `TimeoutError: Knex/Kysely timeout pool` or HTTP 500 spikes under heavy load.

**Diagnosis:**
```sql
SELECT count(*), state FROM pg_stat_activity GROUP BY state;
```

**Resolution:**
1. Check `DATABASE_MAX_CONNECTIONS` in `.env`. The default is `10`. On multi-core production nodes, adjust according to available RAM:
   ```env
   DATABASE_MAX_CONNECTIONS=25
   ```
2. When deploying to serverless platforms (e.g. Neon or Render), enable connection pooling via PgBouncer. Ensure `DATABASE_URL` points to the pooled connection port (`5432` or `6543`).

---

## 3. Disaster Recovery Matrix

| Disaster Scenario | Recovery Point Objective (RPO) | Recovery Time Objective (RTO) | Recovery Action |
| :--- | :--- | :--- | :--- |
| **Complete Server Instance Crash** | 0 minutes (Stateless) | < 5 minutes | Render / Docker automatically redeploys latest container image. |
| **Database Corruption / Loss** | < 24 hours | < 30 minutes | Restore latest `pg_dump` snapshot to fresh PostgreSQL instance; update `DATABASE_URL`. |
| **Tablet Lost / Stolen in Field** | N/A (Device revoked) | Immediate | District Admin revokes device ID in Matru Suraksha admin portal; device remote-wiped upon next network connection. |
| **Accidental Database Truncation** | < 1 hour | < 1 hour | Point-In-Time-Recovery (PITR) via PostgreSQL WAL archive or Neon point-in-time branch restore. |
