# Project Map — Matru Suraksha

Hierarchical index for agents and contributors. Load only the section you need.

## Root

- `AGENTS.md` — agent rules, quality gates, red lines, boundaries.
- `CONSTRAINTS.md` — enforced thresholds (do not weaken).
- `tasks/plan.md` — production launch plan (Wave 0–5, many items open).
- `tasks/offline-pilot-plan.md` — offline-first pilot + Capacitor APK plan.
- `tasks/offline-pilot-todo.md` — checklist for the above.
- `docs/specs/` — feature specs (roles/follow-up, authz, web-security, pwa-privacy, …).
- `docs/runbooks/` — ops runbooks (free-demo-deploy, offline-pilot).

## Packages

### `packages/shared/` — types, schemas, rule engine (no HTTP)
- `src/schemas.ts` — Zod schemas: Create/Update/Sync payloads, follow-up, dispatch, staff.
- `src/types.ts` — base types (Patient, Visit, FollowUp, User, Facility, …).
- `src/rules.ts`, `src/date-utils.ts` — risk score, follow-up date helpers.
- `src/hrp-reasons.ts` — HRP reason enum.

### `packages/server/` — Fastify API + DB
- `src/index.ts` — server entry, plugin registration, graceful shutdown.
- `src/config.ts` — typed env config (secrets, CORS, JWT, cookie).
- `src/authz/` — policy (`assertCan`) and facility scope.
- `src/db/` — Kysely client, migration runner, types, seed.
- `src/migrations/` — numbered SQL migrations (001–007).
- `src/routes/` — `auth`, `patients`, `visits`, `follow-ups`, `referrals`, `sync`, `hrp`, `nodal`, `supervision`, `staff`, `facilities`.
- `src/services/` — `risk.ts`, `hrp-follow-up.ts` (15-day cycle ownership).
- `src/lib/` — mappers, serializers, validators, static-client (SPA fallback).
- `src/audit/` — (planned) audit writer.

### `packages/client/` — React PWA
- `src/main.tsx` — providers, SW registration.
- `src/App.tsx` — routes, `ProtectedRoute`, `PublicRoute`, `OnlineGuard` (offline wall — to be removed in offline plan).
- `src/components/Layout.tsx` — responsive shell, offline banner.
- `src/components/ui/` — primitives (Panel, PageHeader, Stat, EmptyState, Sheet, Table, RiskBadge, …).
- `src/pages/` — Dashboard, FieldHome, Patients, AddPatient, PatientDetail, NewVisit, FollowUps, Referrals (removed), Settings, Offline, Login, Supervision, TeamAccess.
- `src/lib/api.ts` — request wrapper, auth refresh, sync/push/pull, queue endpoints.
- `src/lib/session.ts` — role helpers, `useCanWriteClinical`.
- `src/lib/nav.ts` — role-adaptive navigation.
- `src/lib/clinical.ts` — clinical write role gate mirror.
- `src/lib/db/` — (planned) Dexie schema/repositories.
- `src/lib/sync/` — (planned) queue engine, push, pull, triggers.
- `src/utils/sw.ts` — SW registration, online detection.
- `vite.config.ts` — PWA/workbox config (precache 14, NetworkFirst API, no navigateFallback yet).

## Tests

- Client: `src/**/*.test.tsx` (Vitest, jsdom), `src/test/e2e/` (Playwright, mostly absent today).
- Server: `src/**/*.test.ts` unit; `src/**/*.integration.test.ts` (Vitest + testcontainers).
- Shared: pure-function tests.

## Key conventions

- Client never imports server; shared is types + rules only.
- All server inputs validated with Zod.
- Clinical writes gated to ANM/CHO/HRP_HELPDESK_BLOCK/BHM on both sides.
- `@hrp/shared/rules`, never `/rules.js` (enforced by `scripts/check-shared-exports.mjs`).
- Offline: read-only today; write queue planned (see offline-pilot plan).
