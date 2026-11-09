# Matru Suraksha — AI Coding Agent Context & Working Rules

This document provides a concise, high-context operational handbook for AI coding assistants (such as Google Antigravity, GitHub Copilot, Cursor, or Claude Code) working on the **Matru Suraksha** codebase.

---

## 1. Domain & Architecture Mental Model

**Matru Suraksha** is an offline-first clinical tracking and closed-loop follow-up platform for high-risk pregnancies (HRP) across India's public healthcare system (piloted in Araria District, Bihar).

### 1.1 The Six User Roles
The platform enforces a strict 6-tier administrative and clinical role hierarchy:
$$\text{ANM} \longrightarrow \text{CHO} \longrightarrow \text{HRP\_HELPDESK\_BLOCK} \longrightarrow \text{BHM} \longrightarrow \text{HRP\_HELPDESK\_DISTRICT} \longrightarrow \text{DHS}$$

- **`ANM` (Auxiliary Nurse Midwife):** Frontline mobile tablet user at Health Sub-Centres (HSC) and community village outreach sessions (VHSND). Performs 7-field intake and routine ANC checks.
- **`CHO` (Community Health Officer):** Primary healthcare provider at Ayushman Bharat Health & Wellness Centres (HWC-SC). Performs clinical examinations, diagnoses high-risk conditions, and initiates referrals.
- **`HRP_HELPDESK_BLOCK` (Block Helpdesk Operator):** Operates at the Community Health Centre (CHC) / Block Primary Health Centre (BPHC). Conducts telephone outreach and coordinates referrals to Sadar Hospital.
- **`BHM` (Block Health Manager):** Administrative manager overseeing block-level performance, staff compliance, and overdue task escalations.
- **`HRP_HELPDESK_DISTRICT` (District Helpdesk Operator):** Operates at the District Hospital (Sadar Hospital) or District Health Society. Manages district-wide complex referral intake and specialty appointments.
- **`DHS` (District Health Society / Civil Surgeon):** Strategic district executive oversight, monitoring maternal mortality indicators and cross-block metrics.

### 1.2 The 15-Day Closed-Loop Follow-Up Cycle
- When an HRP is identified and referred, a follow-up task is initialized in the **`BLOCK_15_DAY`** tier assigned to the `HRP_HELPDESK_BLOCK`.
- When the block helpdesk establishes contact and verifies hospital care, the task transitions to **`FIELD_15_DAY`**, assigned back to the frontline ANM/CHO for community home monitoring.
- This 15-day cycle repeats automatically until delivery or clinical resolution. Overdue tasks escalate upward to the District Health Society (`DHS`).

---

## 2. Monorepo Structure & Import Boundaries

```
packages/
  shared/   --> Pure business logic, Zod schemas, TypeScript types, date utilities
  server/   --> Fastify 4, Kysely, PostgreSQL, JWT auth, migrations
  client/   --> React 18, Vite, Tailwind CSS, TanStack Query, Dexie (IndexedDB), Capacitor
```

### Architectural Red Lines
- **NO Server-in-Client Imports:** `packages/client` MUST NEVER import from `packages/server` or `src/server`.
- **NO Client-in-Server Imports:** `packages/server` MUST NEVER import from `packages/client` or `src/client`.
- **Shared Package Rebuilds:** If you modify `packages/shared/src/*`, always run `npm run build --workspace=packages/shared` so the `dist/` artifacts update before testing client or server.

---

## 3. Strict Red Lines (The Floor)

Never introduce any of the following into this repository:
1. **Suppression Comments:** Never add `@ts-ignore`, `eslint-disable`, `biome-ignore` (without approval), `# noqa`, or `# type: ignore`.
2. **Stubs / Empty Catch:** Never write `throw new Error("Not implemented")`, empty `catch {}`, or placeholder `TODO` implementations in place of functional code.
3. **Secrets in Source:** Never commit private API keys, database passwords, or JWT secrets. Use environment variables.
4. **Retired Identifiers Violation:**
   The CI script `scripts/check-retired-identifiers.mjs` enforces that deprecated terms are NEVER reintroduced into code, tests, or documentation:
   - **NEVER use:** bare `HELPDESK` (use `HRP_HELPDESK_BLOCK` or `HRP_HELPDESK_DISTRICT`).
   - **NEVER use:** `IMMEDIATE_7_DAYS`, `PMSMA_SESSION`, `VHSND_COMMUNITY`, `getNextPmsmaDate`, `getNextVhsndDate`.
   - **NEVER use:** Old product names `"High-Risk Pregnancy Tracking"` or `"HRP Tracking"` (always use `"Matru Suraksha"`).

---

## 4. Quality Gates & Validation Commands

Always run quality gates before proposing or committing code changes:

| Stage | Command | Checks Enforced |
| :--- | :--- | :--- |
| **Fast Gate** | `npm run check:fast` | TypeScript compilation (`tsc --noEmit`), Biome linting/formatting, custom secret scanning (`scripts/scan-secrets.mjs`), and retired identifiers check. |
| **Task Gate** | `npm run check:task` | Fast gate + Vitest suite + changed lines code coverage $\ge 80\%$. |
| **Full Gate** | `npm run check:full` | Task gate + Semgrep SAST security scan + OSV supply chain vulnerability scan. |
| **Perf/A11y** | `npm run check:perf && npm run check:a11y && npm run check:bundle` | LCP $\le 2.5\text{s}$, CLS $\le 0.1$, zero critical axe violations, bundle $\le 170\,\text{kB}$. |

### Windows PowerShell Tip
On Windows systems running PowerShell, command chaining with `&&` may fail in some environments. Either run commands individually or separate them with semicolons:
```powershell
npm run build --workspace=packages/shared; npm run check:fast
```

---

## 5. Key Source Files Reference

| Purpose | File Path |
| :--- | :--- |
| **HRP Risk Rules** | [packages/shared/src/rules.ts](file:///c:/Users/ADITYA/Downloads/HRP/packages/shared/src/rules.ts) |
| **Domain Schemas & Validation** | [packages/shared/src/schemas.ts](file:///c:/Users/ADITYA/Downloads/HRP/packages/shared/src/schemas.ts) |
| **Date & Interval Logic** | [packages/shared/src/date-utils.ts](file:///c:/Users/ADITYA/Downloads/HRP/packages/shared/src/date-utils.ts) |
| **Database Schema Migrations** | [packages/server/src/db/migrations/](file:///c:/Users/ADITYA/Downloads/HRP/packages/server/src/db/migrations/) |
| **Server Route Controllers** | [packages/server/src/routes/](file:///c:/Users/ADITYA/Downloads/HRP/packages/server/src/routes/) |
| **Auth & ABAC Middleware** | [packages/server/src/middleware/auth.ts](file:///c:/Users/ADITYA/Downloads/HRP/packages/server/src/middleware/auth.ts) |
| **Client Local DB & Encryption** | [packages/client/src/db/index.ts](file:///c:/Users/ADITYA/Downloads/HRP/packages/client/src/db/index.ts) |
| **Client Offline Sync Engine** | [packages/client/src/services/syncEngine.ts](file:///c:/Users/ADITYA/Downloads/HRP/packages/client/src/services/syncEngine.ts) |
| **Secret Scanner Configuration** | [scripts/scan-secrets.mjs](file:///c:/Users/ADITYA/Downloads/HRP/scripts/scan-secrets.mjs) |
| **Retired Identifiers Checker** | [scripts/check-retired-identifiers.mjs](file:///c:/Users/ADITYA/Downloads/HRP/scripts/check-retired-identifiers.mjs) |
