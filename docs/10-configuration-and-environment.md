# Matru Suraksha — Configuration and Environment

This document defines the configuration options, environment variables, validation rules, and default behaviors across all components of **Matru Suraksha**.

---

## 1. Environment Variable Reference

### 1.1 Server Core Configuration (`packages/server`)

Validated in `packages/server/src/config.ts` using strict Zod parsing upon application startup:

| Variable | Required | Default | Allowed Values / Format | Purpose |
| :--- | :---: | :---: | :--- | :--- |
| `NODE_ENV` | No | `development` | `development`, `test`, `production` | Execution environment mode. |
| `PORT` | No | `3000` | Integer (1–65535) | TCP port the Fastify server binds to. |
| `HOST` | No | `0.0.0.0` | IP Address / Hostname | Network interface binding address. |
| `DATABASE_URL` | **Yes** | — | `postgresql://user:pass@host:5432/db` | PostgreSQL connection string. |
| `JWT_SECRET` | **Yes** | — | String (>= 32 chars in production) | HMAC key for signing short-lived access tokens. |
| `JWT_REFRESH_SECRET`| **Yes** | — | String (>= 32 chars, != `JWT_SECRET`)| HMAC key for signing refresh tokens. |
| `JWT_ACCESS_TTL` | No | `15m` | Time format (e.g., `15m`, `1h`) | Lifetime of the access token. |
| `JWT_REFRESH_TTL`| No | `7d` | Time format (e.g., `7d`, `30d`) | Lifetime of the refresh token. |
| `CORS_ORIGINS` | No | `http://localhost:5173` | Comma-separated URLs (never `*`) | Allowed web origins. `https://localhost` is always permitted for Android. |
| `COOKIE_SECURE` | No | `false` | `true`, `false` | Sets `Secure` attribute on cookies. Must be `true` in production (HTTPS). |
| `TRUST_PROXY` | No | `false` | `true`, `false` | Trust upstream proxy headers (`X-Forwarded-*`). |
| `DB_POOL_MAX` | No | `10` | Integer (>= 1) | Maximum PostgreSQL pool connections. |
| `DB_SSL_CA` | No | — | File path | Path to CA root certificate for TLS verification. |
| `DB_MIGRATION_LOCK_ID`| No | `727001` | Integer | PostgreSQL advisory lock ID for migration serialization. |
| `RATE_LIMIT_AUTH`| No | `100` | Integer | Max auth requests per minute per IP. |
| `RATE_LIMIT_API` | No | `500` | Integer | Max general API requests per minute per IP. |
| `RATE_LIMIT_SYNC`| No | `60` | Integer | Max sync requests per minute per IP. |
| `LOG_LEVEL` | No | `info` | `fatal`, `error`, `warn`, `info`, `debug`, `trace` | Server logging verbosity. |
| `APP_VERSION` | No | `0.0.0` | SemVer string | Current running application version. |
| `GIT_SHA` | No | `unknown` | 7–40 char Git commit hash | Deployed commit identifier. |
| `APK_DOWNLOAD_URL`| No | — | Absolute URL | Static fallback download link for Android APK. |
| `APK_SHA256` | No | — | 64-char hex string | Checksum for verifying downloaded APK integrity. |
| `CLIENT_DIST_PATH`| No | `../client/dist` | Directory path | Location of compiled static web bundle. |
| `SERVE_CLIENT` | No | `false` | `true`, `false` | When true, Fastify serves SPA bundle directly. |

---

### 1.2 Client Build & Runtime Configuration (`packages/client`)

Configured via Vite environment variables prefixed with `VITE_`:

| Variable | Required | Default | Allowed Values | Purpose |
| :--- | :---: | :---: | :--- | :--- |
| `VITE_API_URL` | No | `/api` | Relative path or absolute URL | API base URL. Set to absolute origin for Android APK builds. |
| `VITE_NATIVE_APP`| No | `false` | `true`, `false` | Enables Capacitor native auth transport and hardware hooks. |
| `VITE_DEMO_MODE` | No | `true` | `true`, `false` | When `false`, disables pre-filled demo logins and enforces mandatory PIN encryption. |

---

### 1.3 Container Orchestration Variables

Used by Docker Compose files (`docker-compose.yml`, `docker-compose.preview.yml`, `docker-compose.prod.yml`):

| Variable | Target Compose File | Purpose | Example Value |
| :--- | :--- | :--- | :--- |
| `PREVIEW_PORT` | `docker-compose.preview.yml` | Port mapped on host for preview stack | `8080` |
| `PREVIEW_DB_PASSWORD` | `docker-compose.preview.yml` | Postgres password for preview db | `preview-password-123` |
| `PREVIEW_JWT_SECRET` | `docker-compose.preview.yml` | Access token secret for preview | `preview-jwt-secret-at-least-32-chars` |
| `PREVIEW_JWT_REFRESH_SECRET` | `docker-compose.preview.yml` | Refresh token secret for preview | `preview-refresh-secret-at-least-32-chars` |
| `HRP_SERVER_IMAGE` | `docker-compose.prod.yml` | Tagged container image for backend | `registry.example.in/hrp-server:1.0.0` |
| `HRP_CLIENT_IMAGE` | `docker-compose.prod.yml` | Tagged container image for frontend | `registry.example.in/hrp-client:1.0.0` |
| `HRP_DB_PASSWORD` | `docker-compose.prod.yml` | Production database password | `<strong-db-password>` |
| `HRP_JWT_SECRET` | `docker-compose.prod.yml` | Production access token secret | `<random-32-char-secret>` |
| `HRP_JWT_REFRESH_SECRET` | `docker-compose.prod.yml` | Production refresh token secret | `<different-random-32-char-secret>` |

---

## 2. Configuration Validation & Fail-Fast Behavior

Configuration loading is strictly defensive:
1. **Startup Validation:** In `packages/server/src/config.ts`, environment variables are parsed through `ConfigSchema` using Zod.
2. **Production Checks:**
   - If `NODE_ENV === "production"`, `JWT_SECRET` and `JWT_REFRESH_SECRET` must be at least 32 characters long.
   - `JWT_SECRET` and `JWT_REFRESH_SECRET` cannot be identical.
   - If any validation rule fails, the Node.js process terminates immediately with an error log detailing the malformed variable, preventing the server from booting in an insecure state.

---

## 3. Configuration Profiles

### 3.1 Local Development Profile (`.env`)
```ini
NODE_ENV=development
PORT=3000
HOST=0.0.0.0
DATABASE_URL=postgresql://hrp:hrp_dev@localhost:5432/hrp
JWT_SECRET=dev-jwt-secret-at-least-32-characters-long
JWT_REFRESH_SECRET=dev-refresh-secret-at-least-32-characters
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=7d
CORS_ORIGINS=http://localhost:5173
COOKIE_SECURE=false
TRUST_PROXY=false
DB_POOL_MAX=10
LOG_LEVEL=info
VITE_API_URL=/api
VITE_DEMO_MODE=true
```

### 3.2 Offline Pilot Handset Profile (`packages/client/.env.production`)
```ini
VITE_API_URL=https://pilot-api.example.gov.in/api
VITE_NATIVE_APP=true
VITE_DEMO_MODE=false
```
*Note: `VITE_DEMO_MODE=false` compiles out pre-filled demo account buttons and mandates local PIN setup and AES-256-GCM encryption on the device.*
