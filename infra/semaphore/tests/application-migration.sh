#!/usr/bin/env bash
set -euo pipefail
name="ngertiin-app-migration-test-$$"
logfile="$(mktemp)"
cleanup() { docker rm -f "$name" >/dev/null 2>&1 || true; rm -f "$logfile"; }
trap cleanup EXIT
docker run -d --name "$name" --tmpfs /var/lib/postgresql/data -p 127.0.0.1::5432 \
 -e POSTGRES_HOST_AUTH_METHOD=trust -e POSTGRES_USER=release -e POSTGRES_DB=release ngertiin-postgres:17-vector >/dev/null
for i in {1..30}; do if docker exec "$name" pg_isready -U release >/dev/null 2>&1; then break; fi; sleep 1; done
port="$(docker port "$name" 5432/tcp | cut -d: -f2)"
DATABASE_URL="postgres://release@127.0.0.1:$port/release" bun run db:migrate > "$logfile" 2>&1 || { cat "$logfile"; exit 1; }
docker exec "$name" sh -c 'pg_dump -U release -d release -Fc > /tmp/release.dump'
docker exec "$name" createdb -U release restored
docker exec "$name" pg_restore --exit-on-error -U release -d restored /tmp/release.dump
docker exec "$name" psql -U release -d restored -Atc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'; SELECT count(*) FROM drizzle.__drizzle_migrations; SELECT extversion FROM pg_extension WHERE extname='vector';"
echo 'Actual repository migrations and restored database passed.'
