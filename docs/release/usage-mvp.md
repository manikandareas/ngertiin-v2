# MVP usage rollout

Apply `bun run db:migrate` to the deployment database before deploying API and web. Migration
`0011_lyrical_moondragon.sql` adds the owner/creation-time Module index and a partial active-run
index by user. It changes no existing rows. No deployment database migration or deployment was
performed in this implementation session.

Defaults: `USAGE_MODULES_WEEKLY_LIMIT=10`, `USAGE_SOURCES_WEEKLY_LIMIT=40`. Reset timezone is
always Asia/Jakarta. Concurrency is one queued/processing module run per account; manual retries
are two per resource lifetime. Existing records in the current week count immediately.

## Verification (2026-09-07)

- PASS: all workspace typechecks and builds; lint/format checks on changed files,
  `git diff --check`, and Drizzle migration consistency check.
- PASS: full migration chain applied to a disposable PostgreSQL 17 instance.
- PASS: direct service calls against that isolated database: combined 40-source quota,
  10-module quota, concurrent contenders for the final source and module slots, queued slot
  rejection, idempotency replay, validation precedence, and rejection before PDF storage calls.
- PASS: two lifetime retries for Sources and Modules, rejection of the third, retry replay,
  retries after weekly quota exhaustion, fresh response allowances, and exhausted-retry
  recommendation eligibility.
- PASS: archive does not refund, Source library reuse does not consume Sources, forced
  idempotency transaction rollback leaves no usage, profile timezone does not affect usage,
  Monday 00:00 WIB boundary reads, and an active run remains visible after the weekly reset.
- PASS: direct error-filter exercise preserves quota context, emits `Retry-After` and structured
  rejection logs. This checks serialization, not an authenticated HTTP round trip.
- The disposable PostgreSQL instance was removed after verification.
- The manual service exercise used temporary external scripts, synthetic records and an inert
  PDF storage adapter. It did not invoke Clerk, Redis, MinIO, OCR, scraping, or AI providers.
  No unit/integration test files were added to the repository.
- NOT RUN: authenticated HTTP/browser flows, input preservation in the browser, reset timer and
  cross-tab rendering, real provider failures, worker retries, real PDF uploads crossing reset,
  and end-to-end Redis/database outage injection. These remain release verification steps.

## Cleanup review (2026-09-07)

- Separated generation failure/retry and source retry into focused React components; preserved
  command keys for ambiguous network failures.
- Centralized usage query keys and reset formatting. The connected sidebar owns cross-tab and
  reset synchronization once, even when collapsed. Changes to the active generation slot refresh
  module/dashboard recommendations; retry settlement no longer duplicates its own invalidations.
- Moved shared retry policy/SQL projections out of the injectable service module.
- PASS in this review: all workspace typechecks and builds, changed-file Biome checks (no errors),
  Drizzle migration consistency, and `git diff --check`. The usage prototype retains three CSS
  specificity warnings; broader source lint reports existing prototype CSS warnings.
- NOT RUN again in this review: database service exercises, authenticated HTTP/browser flows,
  provider calls, or migration application. Earlier verification above is retained as historical
  implementation evidence. No unit/integration tests were added.

## Browser release checklist

1. Open the builder in two tabs, exhaust a quota in one, and confirm the other refreshes after
   the mutation signal or regaining focus. Confirm rejected requests preserve input/selections.
2. Confirm the exhausted state displays the next Monday date and `00.00 WIB`; leave the page
   open across reset and confirm the available allowance refreshes.
3. Keep one generation queued/processing. Confirm create/retry is blocked and the active-module
   link opens it. Complete/fail that run and confirm the slot becomes available.
4. Exhaust retry allowances. Confirm retry buttons disappear, the two-retry explanation appears,
   and provider failure copy remains visible.
5. Disconnect Redis and confirm PostgreSQL quota rejection still applies; disconnect PostgreSQL
   and confirm creation fails without a storage upload or accepted command.

Review `usage.rejected` structured logs after release to tune weekly defaults. Per-account limits
do not impose a global cost ceiling or prevent the creation of multiple accounts.
