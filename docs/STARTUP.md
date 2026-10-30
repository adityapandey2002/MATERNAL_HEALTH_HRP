# Matru Suraksha — Startup & Operations Guide

Run all commands from the repo root: `C:\Users\ADITYA\Downloads\HRP`

## 1. Prerequisites

| Tool | Purpose |
|------|---------|
| Docker Desktop | Runs Postgres + Fastify API + Vite client (recommended) |
| Node.js ≥ 20 (not v26 — see note below) | Host-mode dev / typecheck / tests |
| npm (comes with Node) | Workspace scripts |

> **Node v26 on Windows:** ports report as listening but are unreachable (loopback bug). Use Docker for the stack, or run Node ≥20 for host mode.

## 2. Docker Compose (recommended)

Docker CLI must be on `PATH` in every PowerShell session, otherwise compose fails with credential/connection errors:

```powershell
$env:PATH = "C:\Users\ADITYA\AppData\Local\Programs\DockerDesktop\resources\bin;" + $env:PATH
```

### First time
```powershell
# 1) Start Postgres only and wait for it to become healthy
c

# 2) Apply the database schema (idempotent) and load demo data
npm run db:migrate
npm run db:seed

# 3) Start the whole stack (db + api server + client PWA)
docker compose up -d
```

### Every subsequent session
```powershell
$env:PATH = "..."   # (repeat the PATH line above)
docker compose up -d
```

### Shutdown
```powershell
docker compose down        # stop containers, keep Postgres data
docker compose down -v     # stop and wipe Postgres data
```

## 3. Host mode (no Docker)

Requires a local Postgres at `postgresql://hrp:hrp_dev@localhost:5432/hrp`:

```powershell
npm install
npm run db:up            # needs docker just for Postgres, or run your own Postgres
npm run db:migrate
npm run db:seed

# Two terminals:
npm run dev:server   # Fastify API -> http://localhost:3000
npm run dev:client   # Vite PWA      -> http://localhost:5173
```

## 4. Open the app

| Service | URL |
|---------|-----|
| Front (Dashboard, PWA) | http://localhost:5173 |
| API | http://localhost:3000 |
| Health check | http://localhost:3000/health |

**Demo users** (after `db:seed`), all password `password123`:

| Role | Login | Name |
|------|-------|------|
| ANM | ANM001 | Asha Ben |
| CHO | CHO001 | Dr. Priya Patel |
| HRP Helpdesk (block) | helpdesk.daskroi@araria.gov.in | Amit Kumar |
| BHM | MO001 | Dr. Rajesh Kumar |
| HRP Helpdesk (district) | helpdesk.district@araria.gov.in | District helpdesk |
| DHS | ADM001 | District Admin |

### What lands on the front page
- ANM/CHO `/` → **Add HRP case** action, then `/dashboard` for field triage and `/follow-ups` for the 15-day cycle.
- Block roles `/` → **Block dashboard** with dispatch box.
- District roles `/` → **District dashboard** with escalated cases.
- `/patients/new` → HRP intake form.
- `/follow-ups` → field 15-day panel or the shared block/district line list.

## 5. Verify the stack

```powershell
# End-to-end API checks against the running server
npm run test:smoke

# Same checks through the Vite proxy (same-origin, tests httpOnly refresh cookie)
npm run test:smoke:proxy
```

## 6. Quality gates (run after any edit)

| Stage | Command | What it checks |
|-------|---------|----------------|
| Fast | `npm run check:fast` | TypeScript, Biome lint, local secret scan |
| Task | `npm run check:task` | Fast + coverage on changed lines (≥ 80%) |
| Full | `npm run check:full` | Fast + coverage + CI security scans (semgrep/osv skip locally) |
| Tests | `npm test` | All Vitest unit tests |
| Build + bundle | `npm run build` | Production client build (main JS ≤ 170 kB gz) |

## 7. Troubleshooting

### Sign-in 404 (`auth/login:1 404 Not Found`)
**Cause:** `VITE_API_URL` is set to an empty string, so requests go to `/auth/login` instead of `/api/auth/login`, and Vite's proxy only rewrites `/api/*`.

**Fix:** `VITE_API_URL` must be `/api` (host mode) or unset; it must NOT be `""`.
- Host mode: do **not** set `VITE_API_URL` (defaults to `/api`).
- Docker: `packages/client/Dockerfile.dev` / compose sets `VITE_API_URL: ""` — change it to `/api` or remove the line, then `docker compose up -d --build client`.

### Service Worker MIME error
`[SW] Registration failed ... unsupported MIME type ('text/html')`

**Cause:** Vite is falling back to `index.html` for `/sw.js` instead of serving the generated service worker.

**Fix:** Ensure `vite-plugin-pwa` is active and `src/main.tsx` registers the SW only in production:
```ts
if (import.meta.env.PROD) {
  await import("./utils/sw").then((m) => m.registerSW?.())
}
```
For local dev you can safely ignore this error — the app works without the SW until you build for production.

### Ports report listening but are unreachable
**Cause:** Node v26 loopback bug on Windows.

**Fix:** Run the stack in Docker (node:20-alpine containers), not host Node v26.

### Docker compose fails with credential errors
**Cause:** Docker CLI not on `PATH`.

**Fix:** Run the `$env:PATH = "..."` line from section 2 in the current PowerShell window.

## 8. Files changed by this guide
- `docs/STARTUP.md` (this file)

See also: `README.md` (stack overview), `CONSTRAINTS.md` (quality gates), `AGENTS.md` (agent instructions), `.github/workflows/ci.yml` (CI jobs).
