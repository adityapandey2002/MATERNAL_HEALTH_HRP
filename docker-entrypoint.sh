#!/bin/sh
set -eu

echo "[entrypoint] applying database migrations"
attempt=1
until node packages/server/dist/db/migrate.js; do
  if [ "$attempt" -ge 5 ]; then
    echo "[entrypoint] migrations failed after $attempt attempts" >&2
    exit 1
  fi
  echo "[entrypoint] migrations failed (attempt $attempt); retrying in 5s" >&2
  attempt=$((attempt + 1))
  sleep 5
done

echo "[entrypoint] checking demo seed"
node packages/server/dist/db/demo-bootstrap.js

echo "[entrypoint] starting server on port ${PORT:-3000}"
exec node packages/server/dist/index.js
