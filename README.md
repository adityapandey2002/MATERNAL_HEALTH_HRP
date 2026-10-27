# HRP Tracking Platform

Multi-tier High-Risk Pregnancy tracking for India's public health system.

## Stack

- **Frontend**: React + Vite + TypeScript + Workbox (PWA)
- **Backend**: Fastify + TypeScript
- **Database**: PostgreSQL (Kysely)
- **Testing**: Vitest (unit) + Playwright (E2E)
- **Offline**: IndexedDB via Dexie + Service Worker
- **Sync**: Custom push/pull with conflict detection

## Quick Start

### Option A: Docker (everything in containers)

```bash
# 1. Start Docker Desktop and wait for it to report "Docker Desktop is running"

# 2. Build and start the whole stack (db + api + web)
docker compose up -d

# 3. Prepare the database (first run only)
npm run db:migrate
npm run db:seed

# 4. Open http://localhost:5173
```

| Service | URL |
|---------|-----|
| Web app (PWA) | http://localhost:5173 |
| API | http://localhost:3000 |
| Health check | http://localhost:3000/health |

The client calls the API through a Vite proxy on the same origin, so the
httpOnly refresh cookie works without cross-origin cookie rules.

### Option B: Run the dev servers on the host

```bash
# Install dependencies (resolves @hrp/* from the local workspaces)
npm install

# Start PostgreSQL
npm run db:up

# Run migrations & seed
npm run db:migrate
npm run db:seed

# Start dev servers (both client & server)
npm run dev

# Or separately, in two terminals:
npm run dev:client  # http://localhost:5173
npm run dev:server  # http://localhost:3000
```

### Verify the stack

```bash
npm run test:smoke          # exercises the API end to end
npm run test:smoke:proxy    # same, through the Vite proxy
```

## Test Users (after seed)

| Role | Employee ID | Password |
|------|-------------|----------|
| ANM | ANM001 | password123 |
| CHO | CHO001 | password123 |
| BHM | MO001 | password123 |
| DHS | ADM001 | password123 |

## Quality Gates

```bash
# Fast checks (types, lint, secrets) - runs after every edit
npm run check:fast

# Task completion (fast + coverage on changed lines ≥ 80%)
npm run check:task

# Full gate (all + secret scan; semgrep/osv-scanner run in CI)
npm run check:full

# Preview deploy checks (perf, a11y, bundle)
npm run check:perf && npm run check:a11y && npm run check:bundle
```

`check:full` runs the local secret scanner (`scripts/scan-secrets.mjs`). Semgrep
and osv-scanner are CI-only binaries: locally they are skipped with a notice,
while in CI (`CI=true`) a missing scanner fails the build.

## Project Structure

```
hrp/
├── packages/
│   ├── shared/          # Types, Zod schemas, rule engine (pure TS)
│   ├── client/          # React PWA (ANM mobile + CHO desktop)
│   └── server/          # Fastify API
├── scripts/
│   ├── check-changed-coverage.mjs  # 80% bar on changed lines
│   ├── scan-secrets.mjs            # local secret scan
│   ├── run-security-tool.mjs       # skips CI-only scanners locally
│   └── smoke-test.mjs              # end-to-end API checks
├── .github/workflows/ci.yml
├── Dockerfile.server              # root-context production image
├── Dockerfile.client              # root-context production image
├── Dockerfile                     # single-origin free-demo image
├── render.yaml                    # Render blueprint for the free demo
├── docker-compose.yml             # local development stack
├── docker-compose.preview.yml     # built same-origin preview stack
├── docker-compose.prod.yml        # registry-image production stack
├── CONSTRAINTS.md
├── AGENTS.md
└── docs/
    ├── runbooks/deployment.md     # build, deploy, rollback
    ├── runbooks/free-demo-deploy.md # Render + Neon, synthetic data only
    └── ideas/hrp-tracking-mvp.md
```

## Architecture Boundaries

- `packages/client` → never imports `packages/server`
- `packages/server` → never imports `packages/client`
- `packages/shared` → types, utilities, rule engine only

## Offline-First Design

1. ANM registers patient/visit on mobile (PWA)
2. Data stored in IndexedDB (Dexie) immediately
3. Background sync pushes to server when online
4. Server processes & broadcasts to CHO dashboard
5. Conflicts resolved via Last-Write-Wins (field-level)

## Key Features (MVP)

- [x] Patient registration with 8 danger signs
- [x] ANC visit logging with vitals
- [x] Auto HRP risk scoring (configurable rules)
- [x] CHO dashboard with triage line list
- [x] Referral workflow (ANM → CHO → BHM → DHS)
- [x] Offline sync with conflict handling
- [x] Supervision alerts (ANM offline, overdue visits)
- [x] JWT auth with refresh tokens
- [ ] ABDM integration (v2)
- [ ] FHIR R4 export (v2)
- [ ] eSanjeevani teleconsultation (v2)

## Deployment

Both images build from the repository root with the root lockfile and workspace
packages. The client image serves the PWA and proxies `/api`, `/health`, and
`/ready` to the server, so browser traffic stays same-origin.

### Free demo (Render + Neon)

For a public demo with synthetic data only, `render.yaml` and `Dockerfile`
deploy one free Render web service that serves both the API and the PWA from a
single origin, backed by a free Neon Postgres database. Migrations and the
one-time demo seed run automatically on boot. Follow
[`docs/runbooks/free-demo-deploy.md`](docs/runbooks/free-demo-deploy.md).

Do not load real patient data into the demo stack.

### Preview stack

The preview stack builds the images locally and runs a one-off migration before
starting the server:

```powershell
$env:PREVIEW_DB_PASSWORD = "preview-db-password"
$env:PREVIEW_JWT_SECRET = "preview-jwt-secret-at-least-32-characters"
$env:PREVIEW_JWT_REFRESH_SECRET = "preview-refresh-secret-at-least-32-characters"
$env:PREVIEW_PORT = "8080"
docker compose -f docker-compose.preview.yml up -d --build
```

Open `http://localhost:$env:PREVIEW_PORT`. Do not use preview secrets in production.

### Production stack

`docker-compose.prod.yml` consumes registry images and fails closed when a
required value is missing:

```powershell
$env:HRP_SERVER_IMAGE = "registry.example.in/hrp-server:$SHA"
$env:HRP_CLIENT_IMAGE = "registry.example.in/hrp-client:$SHA"
$env:HRP_DB_PASSWORD = "<database password>"
$env:HRP_JWT_SECRET = "<at least 32 characters>"
$env:HRP_JWT_REFRESH_SECRET = "<at least 32 characters, different from JWT_SECRET>"
docker compose -f docker-compose.prod.yml up -d
```

The compose file runs the migration job to completion before starting the
server, waits for server readiness before starting the client, keeps the
database off the host network, and restarts long-running containers. Build,
tagging, smoke checks, and rollback are documented in
[`docs/runbooks/deployment.md`](docs/runbooks/deployment.md).

### Health endpoints

| Endpoint | Semantics |
|----------|-----------|
| `GET /health` | Liveness only; does not touch the database |
| `GET /ready` | Readiness; requires database connectivity and an applied migration |

Both endpoints are reachable through the client edge on the same origin.

## Constraints

See `CONSTRAINTS.md` for enforced quality gates:
- No `@ts-ignore`, `eslint-disable`, empty `catch {}`
- Changed-line coverage ≥ 80%
- Zero critical a11y violations
- LCP ≤ 2.5s, CLS ≤ 0.1
- Bundle ≤ 170 kB gzipped

## License

Government of India / NHM project
