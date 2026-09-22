# Ngerti.in Semaphore deployment

Semaphore Community **2.19.12** coordinates GitHub Actions and Dokploy at
<https://deploy.whoismanik.dev>. The application build stays on GitHub runners.
One `Ngerti.in Production` project has Deploy Backend, Deploy Web, Deploy WWW,
and Deploy All. `release_ref` defaults to `main`; the coordinator resolves it
once to a full SHA. Git pushes do not deploy production. Installation IDs and
acceptance evidence are recorded in [installation.json](installation.json).
The installed controller currently uses branch `ops/semaphore-ui`; keep that
branch available until `workflow_ref` is intentionally moved to another reviewed
ref. Application `release_ref` still defaults to `main`.

## Installation

`compose.yml` pins the verified AMD64/ARM64 image index digest. That image already
contains Python 3.12, Git and OpenSSH; no derived image or application build runner
is required. SQLite, configuration/encryption keys and release journals live on
persistent volumes. The service has no Docker socket, host filesystem mount, or
published database port. Dokploy provides Traefik routing to service `semaphore`,
port 3000, HTTPS/Let's Encrypt, hostname `deploy.whoismanik.dev`.

1. Create a **separate** Dokploy docker-compose resource in the production
   environment. Disable auto-deploy. Set its command to `compose -p <appName> -f docker-compose.yml up -d --force-recreate --remove-orphans` so
   changes to mounted configuration take effect on deployment.
2. Copy `release.example.json` to a private `release.json`, fill in the release
   backup ID, and keep `activation_verified=false` until acceptance is complete.
3. Generate an administrator password and a 32-byte base64 encryption key.
   Save `SEMAPHORE_ADMIN_PASSWORD` and `SEMAPHORE_ACCESS_KEY_ENCRYPTION` in the
   resource's environment. Preserve the encryption key across every upgrade.
4. For initial provisioning only, set `BOOTSTRAP_GITHUB_TOKEN` and
   `BOOTSTRAP_DOKPLOY_TOKEN`. Render raw Compose with:
   `python3 infra/semaphore/render-compose.py --config /private/release.json`.
   Submit the resulting text to `compose.update` and deploy. The renderer embeds
   reviewed coordinator files; application Compose is fetched separately per SHA.
5. `provision.py` creates the four templates and stores tokens as **encrypted
   Semaphore environment secrets** named `GITHUB_TOKEN` and `DOKPLOY_TOKEN`.
   Verify `/var/lib/semaphore/provisioned.json`, then remove the two bootstrap
   tokens from Dokploy environment and recreate the container. Do not delete the
   provisioning marker or regenerate the key once project secrets exist.
6. Set an A record `deploy` to the VPS. Use DNS-only while the origin certificate
   is issued, then optionally enable Cloudflare proxy with strict TLS.

Prefer a GitHub fine-grained token restricted to `manikandareas/ngertiin-v2`, with
Contents read and Actions read/write. GitHub environment `production` retains
Cloudflare secrets and Clerk variables. Runtime database/provider/R2 secrets stay
in Dokploy. The existing `gh` credential is a broader fallback explicitly allowed
by the operator during initial installation; replace it with a repository-scoped
token when available. Never print tokens, provider responses or environment dumps.

Dokploy **v0.29.11** was verified live. Its `docker.getConfig`,
`docker.getContainersByAppNameMatch` (includes stopped containers), and
`compose.readLogs` APIs provide the required exit codes and startup evidence.
Therefore this installation uses the operator-requested API token instead of the
planned SSH helper. No SSH key or Docker socket is required. Logs are reduced to
readiness evidence and are not copied into release output. This token needs
service/environment read, deployment and backup create/read, Compose/environment
update, and Docker read permissions. Verify actual permissions against the live
instance; its existing token can have broader rights.

## Release contract

- `workflow_ref` selects the reviewed **controller workflow**. `release_sha`
  selects candidate source. Do not confuse Actions `head_sha` with candidate SHA.
- Both workflows accept optional `release_sha` and `release_id`, keep manual
  dispatch, and derive image/artifact names from `git rev-parse HEAD`.
- Correlate GitHub runs by exact unique release ID, app, SHA and workflow; inspect
  every expected job. An unrelated newer run cannot satisfy a release.
- Backend: build all three images; dedicated PostgreSQL backup; candidate
  one-shot migration; candidate raw Compose and only `RELEASE_TAG` replacement;
  deploy API/worker; verify both images, Docker API health, public readiness and
  worker startup with zero restarts for a stable observation window.
- Existing Compose IDs, app names, domain entries, network and runtime environment
  remain in place. Migration is a dedicated docker-compose resource with
  `restart: 'no'`, forced recreation, and a new container ID per attempt.
- Backup uses a separate **unscheduled** configuration: `postgres/releases`,
  retention 10. Daily/weekly schedules are not modified. Success requires the
  correlated backup deployment to be `done` after export/upload.
- Frontend-only never changes the backend or runs backup. Deploy All resolves once
  and runs Backend → Web → WWW, stopping on the first failure.
- Automatic migrations must remain compatible with the old app while it runs.
  Use maintenance for destructive/incompatible schema changes. The pipeline does
  not replace the PostgreSQL image or roll back the database.

The Semaphore project parallel limit is one. A shared OS lock additionally
serializes all templates/processes. Before every remote write, the coordinator
fsyncs an intent to `/var/lib/semaphore/releases/active.json`. Completed releases
are archived by release ID. Journals include SHA, previous release/Compose, stages,
GitHub links/run IDs, Dokploy deployment IDs and candidate container IDs. They
exclude runtime environment values and are private (0600).

Timeouts: GitHub build/deploy 60 minutes; backup, migration and Dokploy deployment
30 minutes each; public health 5 minutes. A timeout, cancellation or service
restart can leave remote work running. Every failure retains `active.json` and
**blocks all four templates**, including frontend-only, until reconciliation.

## Recovery

1. Stop accepting new tasks; check Semaphore queue and running tasks. Acquire the
   same `production.lock` before changing a journal. Never delete the lock file:
   replacing its inode defeats process exclusion.
2. Read `release.py status`; inspect exact GitHub run IDs/title, Dokploy IDs and
   backup history. For a dispatch intent without an ID, find the corresponding
   unique release title (backup uses the recorded prior-ID set). An absent or
   ambiguous result is unresolved, not permission to retry.
3. Check the exact migration image, new container ID, exited state and exit code.
   If the container was removed, recover logs/history and establish the result
   manually. **Never automatically repeat an ambiguous migration.**
4. For backend recovery, use the journal's previous SHA/Compose only after
   confirming compatibility with the current schema. Keep runtime secrets in
   Dokploy. Restore raw Compose and `RELEASE_TAG`, redeploy, and verify API/worker.
   Database recovery is a separate maintenance procedure.
5. Only when remote operations are terminal and application state is understood,
   record operator, timestamp, observed operation IDs/results and recovery in the
   journal. Under the shared lock, archive it as `<release_id>.reconciled.json`.
   Keep the record; do not erase history. Record explicit evidence for every intent
   without a returned operation ID, even if a later API call reports no running job. Frontend-only can then repair a failed
   frontend release.

## Semaphore backup and restore

Run `snapshot.py /private/semaphore-YYYYMMDD.tar.gz` inside the service (or with
both volumes mounted to an administrative container). It uses SQLite's backup API,
checks integrity, and captures config/encryption key, coordinator repository,
provisioning marker and release journals under the deployment lock. The archive
is private and **must be copied off the VPS** to protected backup storage; a copy
on the same volume is not disaster recovery. Preserve Dokploy resource/domain
configuration and the rendered installation source alongside it. Do not print or
commit the archive.

Restore into **new empty volumes**, with Semaphore stopped: unpack the trusted
archive's `data/` and `config/` into the matching mounts, set ownership for uid 1001,
restore the same encryption key and pinned image, and start on an isolated network
without access to production. Verify SQLite integrity, administrator login, four
templates, secret decryption and release journal preservation. Reconcile any
`active.json` against remote operations before enabling production access. Never
start a restored clone with production credentials and network access concurrently
with the primary instance.

## Verification and activation

```sh
python3 -m unittest discover -s infra/semaphore/tests -v
python3 infra/semaphore/tests/semaphore-restore.py
bash infra/semaphore/tests/disposable.sh
bash infra/semaphore/tests/application-migration.sh
python3 infra/semaphore/render-compose.py --config /private/release.json > /tmp/semaphore.yml
# Set dummy setup variables, then docker compose -f /tmp/semaphore.yml config --quiet
```

The disposable test uses a local pgvector image, an isolated network, tmpfs storage,
PostgreSQL custom backup/restore, and successful/failed SQL migrations. The application-migration test also runs all repository Drizzle migrations and
restores their complete schema into a second disposable database. Neither test
claims a provider-backed application E2E test. Verify live resource IDs, Dokploy
version/API, PostgreSQL image and pgvector, VPS capacity and backup destination
before activation. Publish controller workflows before enabling task execution.
Validate in order: read-only preflight, WWW, Web, Backend, then All using an
explicit candidate when an additional complete deployment is warranted. The
operator requested no redundant live verification during this installation, so
All uses the locally tested sequence without repeating the successful component
deployments. Authenticated smoke tests cover login, a worker job, and chat/SSE. HTTP 200
alone does not certify those authenticated flows.

References: [Semaphore Docker](https://semaphoreui.com/docs/admin-guide/installation/docker),
[Dokploy Compose API](https://docs.dokploy.com/docs/api/compose),
[Dokploy backup API](https://docs.dokploy.com/docs/api/backup).
