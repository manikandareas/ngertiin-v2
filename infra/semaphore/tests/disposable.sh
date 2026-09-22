#!/usr/bin/env bash
# Local-only PostgreSQL backup/restore and migration exit-code rehearsal.
set -euo pipefail
name="ngertiin-release-test-$(date +%s)-$$"
image="${TEST_POSTGRES_IMAGE:-ngertiin-postgres:17-vector}"
cleanup() { docker rm -f "$name" >/dev/null 2>&1 || true; }
trap cleanup EXIT
docker run -d --name "$name" --network none --tmpfs /var/lib/postgresql/data \
  -e POSTGRES_HOST_AUTH_METHOD=trust -e POSTGRES_USER=release -e POSTGRES_DB=release "$image" >/dev/null
for i in {1..30}; do
  if docker exec "$name" pg_isready -U release >/dev/null 2>&1; then break; fi
  sleep 1
done
docker exec "$name" psql -U release -d release -v ON_ERROR_STOP=1 -c \
  'CREATE EXTENSION vector; CREATE TABLE release_probe(id integer PRIMARY KEY, value text); INSERT INTO release_probe VALUES(1, '\''before backup'\'');' >/dev/null
docker exec "$name" sh -c 'pg_dump -U release -d release -Fc > /tmp/release.dump'
docker exec "$name" createdb -U release restored
docker exec "$name" pg_restore --exit-on-error -U release -d restored /tmp/release.dump
result="$(docker exec "$name" psql -U release -d restored -Atc 'SELECT value FROM release_probe WHERE id=1')"
[[ "$result" == 'before backup' ]]
docker exec "$name" psql -U release -d restored -v ON_ERROR_STOP=1 -c 'ALTER TABLE release_probe ADD COLUMN optional_value text' >/dev/null
if docker exec "$name" psql -U release -d restored -v ON_ERROR_STOP=1 -c 'SELECT definitely_missing_column FROM release_probe' >/dev/null 2>&1; then
  echo 'Expected nonzero migration result' >&2
  exit 1
fi
echo 'Disposable pgvector, backup/restore, compatible migration, and nonzero migration checks passed.'
