# Deployment Runbook

Owner: Operations
Last reviewed: 2026-10-23
Review cadence: every release

## Scope

Build immutable server and client images from the repository root, deploy the
same-origin stack, run migrations before the API starts, and roll back safely.
Images are tagged with the git SHA and never contain `.env` files, source maps,
or test data.

## Prerequisites

- Docker Engine 24+ with Compose v2.
- A container registry reachable by the deployment host.
- TLS termination and reverse proxy in front of the client edge.
- A secrets manager or deployment secret store for database and JWT values.
- PostgreSQL 16 (the compose file runs it as an internal service; managed
  PostgreSQL can replace the `db` service once `DATABASE_URL` is injected the
  same way).

## Build and tag with the git SHA

Run from a clean checkout. Use the full or short SHA consistently; the examples
use the 12-character short SHA.

```powershell
$REGISTRY = "registry.example.in"
$SHA = (git rev-parse --short=12 HEAD)
$VERSION = "0.1.0"

docker build -f Dockerfile.server `
  --build-arg GIT_SHA=$SHA --build-arg APP_VERSION=$VERSION `
  -t "$REGISTRY/hrp-server:$SHA" .
docker build -f Dockerfile.client `
  --build-arg VITE_API_URL=/api `
  --build-arg VITE_APP_VERSION=$VERSION --build-arg VITE_GIT_SHA=$SHA `
  --build-arg APP_VERSION=$VERSION --build-arg GIT_SHA=$SHA `
  -t "$REGISTRY/hrp-client:$SHA" .

docker push "$REGISTRY/hrp-server:$SHA"
docker push "$REGISTRY/hrp-client:$SHA"
```

`VITE_API_URL` must remain `/api` so the browser uses the same origin. Promote
the SHA-tagged digests rather than rebuilding per environment.

### Clean-clone build check

Prove the root context is self-contained before tagging a release:

```powershell
$CLEAN = Join-Path $env:TEMP "hrp-clean-$SHA"
git worktree add --detach $CLEAN HEAD
docker build -f "$CLEAN/Dockerfile.server" -t "hrp-server:clean-$SHA" $CLEAN
docker build -f "$CLEAN/Dockerfile.client" -t "hrp-client:clean-$SHA" $CLEAN
git worktree remove --force $CLEAN
```

## Preview stack

The preview stack builds from the working tree and runs the migration job before
the server.

```powershell
$env:PREVIEW_DB_PASSWORD = "preview-db-password"
$env:PREVIEW_JWT_SECRET = "preview-jwt-secret-at-least-32-characters"
$env:PREVIEW_JWT_REFRESH_SECRET = "preview-refresh-secret-at-least-32-characters"
$env:PREVIEW_PORT = "8080"

docker compose -f docker-compose.preview.yml config
docker compose -f docker-compose.preview.yml up -d --build
```

Verify through the client edge:

```powershell
Invoke-WebRequest -UseBasicParsing "http://localhost:$env:PREVIEW_PORT/" | Select-Object StatusCode
Invoke-WebRequest -UseBasicParsing "http://localhost:$env:PREVIEW_PORT/health" | Select-Object StatusCode
Invoke-WebRequest -UseBasicParsing "http://localhost:$env:PREVIEW_PORT/ready" | Select-Object StatusCode
```

Tear down without deleting the database volume when investigating:
`docker compose -f docker-compose.preview.yml down`. Add `-v` only when a clean
preview database is intended.

## Production stack

Required variables fail closed at `docker compose config` time.

| Variable | Required | Notes |
|---|---|---|
| `HRP_SERVER_IMAGE` | yes | Registry image including the SHA tag |
| `HRP_CLIENT_IMAGE` | yes | Registry image including the same SHA tag |
| `HRP_DB_PASSWORD` | yes | URL-safe value; it is embedded in `DATABASE_URL` |
| `HRP_JWT_SECRET` | yes | At least 32 characters |
| `HRP_JWT_REFRESH_SECRET` | yes | At least 32 characters, different from `HRP_JWT_SECRET` |
| `HRP_DB_USER` | no | Defaults to `hrp` |
| `HRP_DB_NAME` | no | Defaults to `hrp` |
| `HRP_HTTP_PORT` | no | Host port for the client edge, defaults to `8080` |
| `HRP_LOG_LEVEL` | no | Defaults to `info` |
| `HRP_DB_POOL_MAX` | no | Defaults to `10` |
| `APP_VERSION` / `GIT_SHA` | no | Surfaced by `/ready` and image labels |

If the database password contains URL-reserved characters (`@`, `:`, `/`, `%`,
`?`, `#`), percent-encode it or use an alphanumeric secret.

```powershell
$env:HRP_SERVER_IMAGE = "registry.example.in/hrp-server:$SHA"
$env:HRP_CLIENT_IMAGE = "registry.example.in/hrp-client:$SHA"
$env:HRP_DB_PASSWORD = "<database password>"
$env:HRP_JWT_SECRET = "<at least 32 characters>"
$env:HRP_JWT_REFRESH_SECRET = "<at least 32 characters, different>"
$env:HRP_HTTP_PORT = "80"
$env:APP_VERSION = "0.1.0"
$env:GIT_SHA = $SHA

docker compose -f docker-compose.prod.yml config
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml ps
```

`up` starts the database, waits for its healthcheck, runs the one-off `migrate`
service to completion, then starts the server. The client starts only after the
server reports healthy. The database has no host port mapping. Long-running
services use `restart: unless-stopped`; the migration job never restarts.

### Migration job

The migration job runs automatically as part of `up`. Re-run it manually only
during maintenance:

```powershell
docker compose -f docker-compose.prod.yml run --rm migrate
```

Migrations are ordered, checksum-verified, and guarded by a PostgreSQL advisory
lock, so concurrent runs are safe. A failed migration stops the server from
starting. Never edit an applied migration; add a new one.

## Health and readiness

| Endpoint | Expected | Meaning |
|---|---|---|
| `GET /health` | 200 | Process is alive; database is not checked |
| `GET /ready` | 200 | Database reachable and `schema_migrations` has an applied row |
| `GET /ready` | 503 | Database unavailable or no migration applied |

Check from the host through the client edge:

```powershell
Invoke-WebRequest -UseBasicParsing "http://localhost:$env:HRP_HTTP_PORT/ready"
```

If `/ready` is 503, inspect `docker compose -f docker-compose.prod.yml logs db`,
`migrate`, and `server`. Do not route traffic to an unready server.

## Rollback

Images are immutable and tagged by SHA. Prefer rolling the image tags back over
rebuilding.

```powershell
$env:HRP_SERVER_IMAGE = "registry.example.in/hrp-server:<previous-sha>"
$env:HRP_CLIENT_IMAGE = "registry.example.in/hrp-client:<previous-sha>"
docker compose -f docker-compose.prod.yml config
docker compose -f docker-compose.prod.yml up -d --no-deps server client
```

Then verify `/ready`, login, and a scoped read. Database migrations are
forward-only: if the bad release applied a destructive or incompatible
migration, restore the database before rolling back the images (see
[`backup-restore.md`](backup-restore.md)). Use expand/contract migrations so the
previous image can run against the current schema.

Never run `docker compose -f docker-compose.prod.yml down -v` in production; it
deletes the database volume. Do not stop the database to roll back the API.

## Secret handling

- Inject secrets at runtime from the deployment secret store; never bake them
  into images or commit a `.env` file.
- Rotate JWT secrets only with a planned sign-out window; access and refresh
  tokens signed with the old secret stop verifying.
- Rotate the database password by updating the secret, then recreating the
  database and API containers together.
- Do not paste PHI, connection strings, or tokens into tickets, chat, or logs.
