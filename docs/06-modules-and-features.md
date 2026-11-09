# Matru Suraksha — Modules and Features

This document provides a comprehensive, module-by-module breakdown of the **Matru Suraksha** codebase. It covers responsibilities, key source files, primary functions, inputs/outputs, and underlying business rules across the shared library, server, and client packages.

---

## 1. Shared Domain Module (`packages/shared/`)

The `@hrp/shared` workspace is the foundational package for domain types, validation schemas, and clinical algorithms. It compiles to pure ESM JavaScript and is utilized identically by both server and client.

### 1.1 Clinical Rule Engine (`src/rules.ts`)
- **Responsibilities:** Evaluates maternal clinical risk scores, identifies danger signs, and assigns risk levels (`GREEN`, `AMBER`, `RED`).
- **Core Functions:**
  - `calculateRiskScore(input)`: Computes a numeric risk score (0–100) based on maternal age (<18 or >35 years), gravidity (>4), previous cesarean delivery (LSCS), gestational age, vitals (systolic/diastolic blood pressure, hemoglobin), and danger signs.
  - `evaluateDangerSigns(dangerSigns, vitals)`: Identifies acute conditions (e.g., severe preeclampsia, severe anemia where Hb < 7 g/dL) that mandate an immediate `RED` flag.
  - `scoreToRiskLevel(score)`: Maps scores to categorical bands (`GREEN`: < 30, `AMBER`: 30–69, `RED`: >= 70).
- **Dependencies:** `packages/shared/src/types.ts`.
- **Inputs & Outputs:** Accepts patient attributes and ANC vitals; outputs `{ score: number, level: RiskLevel, factors: string[] }`.

### 1.2 Validation Schemas (`src/schemas.ts`)
- **Responsibilities:** Provides authoritative Zod schemas for all inbound and outbound API payloads.
- **Key Schemas:**
  - `CreatePatientSchema` / `UpdatePatientSchema`: Validates patient demographic, obstetric, and clinical intake data.
  - `CreateVisitSchema`: Enforces valid vital parameter ranges (e.g., BP Systolic between 70 and 250 mmHg; Hemoglobin between 3 and 18 g/dL).
  - `DispatchFollowUpSchema`: Validates assignment payloads for pushing patient lists to field workers.
  - `SyncPushSchema`: Validates transactional offline synchronization batches of patients, visits, and follow-ups.
  - `CreateStaffSchema`: Validates account creation rules and facility assignment constraints.

### 1.3 Date & Scheduling Utilities (`src/date-utils.ts`)
- **Responsibilities:** Implements obstetric date calculations and automated follow-up window determination.
- **Core Functions:**
  - `eddFromLmp(lmp: Date)`: Calculates the Estimated Date of Delivery using Naegele's rule (LMP + 280 days).
  - `gestationalAge(lmp: Date, targetDate: Date)`: Calculates completed weeks and days of pregnancy.
  - `scheduleFollowUp(patient, identifiedDate)`: Computes the follow-up track and scheduled date. Referred patients and `RED` risk cases receive an immediate 7-day clinical window; `AMBER` cases align with specialist review sessions; routine `GREEN` cases schedule standard village sessions.

### 1.4 HRP Complications & Reasons Dictionaries
- **`src/hrp-complications.ts`:** Strictly defines the 9 standardized complication options used in intake forms:
  1. `ANEMIA` (Severe Anemia)
  2. `PIH` (Pregnancy-Induced Hypertension)
  3. `GDM` (Gestational Diabetes Mellitus)
  4. `SHORT_STATURE` (Height < 140 cm)
  5. `PRE_LSCS` (Previous Cesarean Delivery)
  6. `MULTI_GRAVIDA` (Gravida >= 4)
  7. `TWINS_MULTIPLE_PREGNANCY` (Multiple Gestation)
  8. `TEENAGE_PREGNANCY` (Age < 19)
  9. `EDEMA` (Pathological Edema)
- **`src/hrp-reasons.ts`:** Maps individual complications to their underlying clinical risk reason categories.
- **`src/hrp-follow-up.ts`:** Exports status triads (`COMPLETE`, `PENDING`, `NOT_REACHABLE`) and stage labels.

---

## 2. Server API Module (`packages/server/`)

The Fastify server handles authentication, authorization, transactional database interactions, offline push/pull processing, and supervisory reporting.

### 2.1 Application Bootstrap & Configuration (`src/app.ts`, `src/config.ts`)
- **Responsibilities:** Initializes Fastify, registers security plugins, binds error handlers, and manages graceful shutdown.
- **Key Features:**
  - Validates typed environment variables (`config.ts`) on startup; exits immediately if critical secrets are malformed.
  - Registers `@fastify/cors` with origin validation allowing web proxies and Capacitor native origins (`https://localhost`).
  - Registers `@fastify/jwt` and `@fastify/cookie` with `SameSite=Lax` and path restrictions.
  - Registers `registerClientStatic()` to serve the frontend SPA bundle in production environments.

### 2.2 Authorization & Facility Scoping Engine (`src/authz/`)
- **`src/authz/policy.ts`:** Implements `assertCan(actor, action, target)`. It evaluates role capabilities across 24 discrete actions (`patient:read`, `patient:write`, `followup:manage`, `staff:manage`, `device:revoke`).
- **`src/authz/scope.ts`:** Enforces facility boundary checks using materialized tree paths. If a supervisor at `INDIA.BIHAR.ARARIA.RANIGANJ` requests patient records, the query is scoped with `facilities.path LIKE 'INDIA.BIHAR.ARARIA.RANIGANJ.%'`. Access across sibling subtrees is denied immediately with HTTP 403 or 404.

### 2.3 Database Layer (`src/db/`)
- **`src/db/client.ts`:** Initializes the Kysely query builder with a PostgreSQL connection pool (`pg.Pool`), configuring pool sizing and statement timeouts.
- **`src/db/migrate.ts`:** Sequential database migration runner. Tracks applied SQL scripts in the `schema_migrations` table with SHA-256 checksums under an advisory lock (`727001`).
- **`src/db/seed.ts` & `src/db/seed-raniganj.ts`:** Seeds realistic synthetic testing data for Araria District facilities, health workers, and cohort pregnancies.

### 2.4 Domain Route Handlers (`src/routes/`)
- **`auth.ts`:** Endpoints for `/api/auth/login`, `/api/auth/refresh`, `/api/auth/me`, and `/api/auth/logout`.
- **`patients.ts` & `hrp.ts`:** Endpoints for creating, updating, retrieving, and searching patient records. Implements duplicate checking and auto-triggers follow-up cycles on HRP intake.
- **`visits.ts`:** Endpoints for recording ANC visits and vitals. Executes dynamic risk re-scoring upon visit entry.
- **`follow-ups.ts`:** Line-list retrieval, status updates (`COMPLETE`, `NOT_REACHABLE`), and supervisory assignment dispatch. Implements automatic transition between `BLOCK_15_DAY` and `FIELD_15_DAY` cycles.
- **`sync.ts`:** Endpoints for `/api/sync/push` and `/api/sync/pull`. Processes transactional mutation batches from offline field devices and returns conflict lists.
- **`staff.ts`:** User management endpoints for creating and updating staff accounts according to the delegated hierarchy.
- **`devices.ts`:** Mobile device registration, heartbeats, and remote revocation.
- **`supervision.ts`:** Supervisory alert monitoring (e.g., ANM offline alerts, visit overdue notices).

---

## 3. Frontend Client Module (`packages/client/`)

The React PWA provides the user interface for field workers, clinical officers, helpdesk operators, and district supervisors.

### 3.1 Offline Database & Repositories (`src/lib/db/`)
- **`src/lib/db/local-db.ts`:** Configures the Dexie database `hrp-matru-suraksha` with tables: `patients`, `visits`, `followUps`, `pendingOps`, `conflicts`, and `meta`.
- **`src/lib/db/repositories.ts`:** Implements `patientRepo`, `visitRepo`, `followUpRepo`, `opRepo`, and `conflictRepo`. Intercepts all read/write operations to apply transparent encryption and decryption via `crypto.ts`.
- **`src/lib/db/queries.ts`:** Provides reactive querying hooks for line lists and dashboard counters filtered by facility and status.

### 3.2 Client Security & Field Cryptography (`src/lib/crypto.ts`, `src/lib/lock.ts`)
- **`crypto.ts`:** Encrypts PII fields (`name`, `phone`, `address`, `notes`) with AES-256-GCM (`enc:v1:<base64>`) before writing to IndexedDB. Generates blind indexes via HKDF-derived HMAC-SHA-256 for exact-name searching.
- **`lock.ts`:** Manages the 6-digit PIN state machine. Derives the KEK using PBKDF2 (600,000 iterations). If 10 consecutive failed PIN attempts occur, it triggers an emergency local database wipe.
- **`LockGate.tsx` & `LockScreen.tsx`:** UI barriers that prompt for PIN verification on initial boot, manual lock, or after 3 minutes in the background.

### 3.3 Offline Synchronization Engine (`src/lib/sync/`)
- **`queue.ts`:** Transactional mutation queue. Appends local operations (`create`, `update`) and drains them sequentially to `/api/sync/push`.
- **`pull.ts`:** Delta synchronization. Queries `/api/sync/pull?since=<lastPulledAt>` to retrieve updates made on other devices or at higher administrative tiers.
- **`engine.ts`:** Coordinates automatic sync triggers on connectivity recovery, app resume, and manual user request.

### 3.4 User Interface & Clinical Workflows (`src/pages/`, `src/components/`)
- **`AddPatient.tsx`:** The 7-field high-risk pregnancy intake form. Adapts referral labels based on user role ("Refer to Sadar hospital" for block staff; "Yes — Refer to CHC/FRU" for field staff).
- **`NewVisit.tsx`:** Point-of-care ANC visit entry form with real-time vitals validation and danger sign screening.
- **`FollowUps.tsx`:** Follow-up management interface. Dynamically renders `FieldFollowUpPanel.tsx` (card-based view for ANM/CHO) or `NodalFollowUpPanel.tsx` (searchable data table with filters for BHM/DHS).
- **`Dashboard.tsx`, `FieldHome.tsx`, `NodalDashboard.tsx`, `DistrictDashboard.tsx`:** Role-customized dashboards displaying triage KPIs, compliance rates, breached escalation queues, and dispatch consoles.
- **`TeamAccess.tsx`:** Hierarchical staff provisioning console allowing BHM and DHS officers to create and manage lower-tier accounts.
- **`Devices.tsx`:** Supervisor console for monitoring enrolled mobile handsets and issuing remote revocations.
