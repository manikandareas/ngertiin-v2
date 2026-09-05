# M9 Release Evidence

Status: **M9 hardening implemented, redirect defenses and runtime certification pending**

Evidence date: 2026-09-05

M9 hardens M0-M8 without adding public endpoints, tables, monitoring platforms, or a second URL
fetcher. Static gates and in-process literal URL probes are the evidence executed for this delivery.
Application runtime, browser, Clerk,
failure-injection, cross-user, and provider evidence remains explicitly `NOT RUN`.

## Static gates

| Gate | Evidence class | Result |
|---|---|---|
| `bun install --frozen-lockfile` | Hermetic | PASS |
| `docker compose config --quiet` | Hermetic | PASS |
| `bun db:check` | Hermetic | PASS |
| `bun typecheck` | Hermetic | PASS |
| `bun lint` | Hermetic | PASS |
| `bun format:check` | Hermetic | PASS |
| `bun run build` | Hermetic | PASS |
| `git diff --check` | Hermetic | PASS |
| Literal URL probe: 11 unsafe URLs rejected, 3 public URLs accepted; no DNS/network | Hermetic manual probe | PASS |

Run all static gates in order with `bun release:check`. No unit or integration test is created or
executed by that command. Run `bun release:integrity` separately against the release-candidate
PostgreSQL database; it is read-only and fails on XP mismatch or duplicate mastery/progress.

## HTTP contract coverage

All `/api/v1` routes require Clerk authentication. Common possible errors are
`AUTHENTICATION_REQUIRED`, `AUTHENTICATION_INVALID`, `VALIDATION_ERROR`, `RATE_LIMITED`, and
`INTERNAL_ERROR`; owned-resource lookups may also return `NOT_FOUND`. Successful responses,
Problem Details, health bodies, and SSE snapshot/progress/terminal events cross exported Zod
schemas. A malformed non-Problem-Detail web error retains the generic transport fallback.

| Method and route | Request schema | Success/event schema | Additional stable errors |
|---|---|---|---|
| `GET /health/live` | none | `liveHealthSchema` | raw health error only |
| `GET /health/ready` | none | `readyHealthSchema` | raw `503` readiness body |
| `GET /api/v1/me` | none | `getCurrentUserResponseSchema` | common |
| `PATCH /api/v1/me` | `patchCurrentUserBodySchema` | `patchCurrentUserResponseSchema` | common |
| `GET /api/v1/dashboard` | none | `getDashboardResponseSchema` | common |
| `POST /api/v1/sources/text` | `createTextSourceBodySchema`, idempotency key | `createTextSourceResponseSchema` | `IDEMPOTENCY_KEY_REQUIRED`, `IDEMPOTENCY_CONFLICT` |
| `POST /api/v1/sources/url` | `createUrlSourceBodySchema`, public URL validation, idempotency key | `createUrlSourceResponseSchema` | `IDEMPOTENCY_KEY_REQUIRED`, `IDEMPOTENCY_CONFLICT` |
| `POST /api/v1/sources/pdf` | `createPdfSourceFieldsSchema`, PDF file, idempotency key | `createPdfSourceResponseSchema` | `SOURCE_TOO_LARGE`, `SOURCE_UNSUPPORTED_MEDIA_TYPE`, `SOURCE_INVALID_PDF`, `DEPENDENCY_UNAVAILABLE`, idempotency errors |
| `GET /api/v1/sources` | `listSourcesQuerySchema` | `listSourcesResponseSchema` | common |
| `GET /api/v1/sources/:sourceId` | `sourceParamsSchema` | `getSourceResponseSchema` | `NOT_FOUND` |
| `POST /api/v1/sources/:sourceId/retry` | `sourceParamsSchema`, idempotency key | `retrySourceResponseSchema` | `SOURCE_RETRY_NOT_ALLOWED`, idempotency errors |
| `POST /api/v1/modules` | `createModuleBodySchema`, idempotency key | `createModuleResponseSchema` | `SOURCE_NOT_READY`, `IDEMPOTENCY_CONFLICT`, `IDEMPOTENCY_KEY_REQUIRED` |
| `GET /api/v1/modules` | `listModulesQuerySchema` | `listModulesResponseSchema` | common |
| `GET /api/v1/modules/:moduleId` | `moduleParamsSchema` | `getModuleResponseSchema` | `NOT_FOUND` |
| `GET /api/v1/modules/:moduleId/generation` | `moduleParamsSchema` | `getGenerationResponseSchema` | `GENERATION_NOT_AVAILABLE`, `NOT_FOUND` |
| `GET /api/v1/modules/:moduleId/generation/events` | `moduleParamsSchema` | `generationEventSchema` | `GENERATION_NOT_AVAILABLE`, `NOT_FOUND` |
| `POST /api/v1/modules/:moduleId/generation/retry` | `moduleParamsSchema`, idempotency key | `retryGenerationResponseSchema` | `GENERATION_RETRY_NOT_ALLOWED`, idempotency errors |
| `GET /api/v1/modules/:moduleId/journey` | `moduleParamsSchema` | `getJourneyResponseSchema` | `MODULE_NOT_READY`, `NOT_FOUND` |
| `GET /api/v1/modules/:moduleId/nodes/:nodeId` | `moduleNodeParamsSchema` | `getNodeResponseSchema` | `MODULE_NOT_LEARNABLE`, `NODE_LOCKED`, `NOT_FOUND` |
| `POST /api/v1/modules/:moduleId/nodes/:nodeId/start` | `moduleNodeParamsSchema` | `startNodeResponseSchema` | `MODULE_NOT_LEARNABLE`, `NODE_LOCKED`, `NOT_FOUND` |
| `POST /api/v1/modules/:moduleId/nodes/:nodeId/complete` | `moduleNodeParamsSchema` | `completeNodeResponseSchema` | `MODULE_NOT_LEARNABLE`, `ATTEMPT_REQUIRED`, `NOT_FOUND` |
| `POST /api/v1/modules/:moduleId/archive` | `moduleParamsSchema` | `archiveModuleResponseSchema` | `MODULE_ARCHIVE_NOT_ALLOWED`, `NOT_FOUND` |
| `POST /api/v1/modules/:moduleId/nodes/:nodeId/attempts` | `moduleNodeParamsSchema`, `submitAttemptBodySchema` | `submitAttemptResponseSchema` | `ACTIVITY_NOT_ASSESSABLE`, `SUBMISSION_CONFLICT`, `MODULE_NOT_LEARNABLE`, `NODE_LOCKED`, `NOT_FOUND` |
| `GET /api/v1/attempts/:attemptId` | `attemptParamsSchema` | `getAttemptResponseSchema` | `NOT_FOUND` |
| `GET /api/v1/adaptive-interventions/:interventionId` | `adaptiveInterventionParamsSchema` | `getAdaptiveInterventionResponseSchema` | `NOT_FOUND` |
| `POST /api/v1/adaptive-interventions/:interventionId/decision` | params, `adaptiveDecisionBodySchema`, idempotency key | `decideAdaptiveInterventionResponseSchema` | `ADAPTIVE_DECISION_ALREADY_MADE`, idempotency errors, `NOT_FOUND` |
| `GET /api/v1/adaptive-interventions/:interventionId/generation/events` | `adaptiveInterventionParamsSchema` | `adaptiveGenerationEventSchema` | `GENERATION_NOT_AVAILABLE`, `NOT_FOUND` |

## Rate-limit and authorization matrix

Buckets are fixed windows keyed by authenticated local user and category. Redis failure is
fail-open with an allowlisted structured warning; readiness still reports Redis `down`.

| Category | Default | Routes | Authorization/state boundary |
|---|---:|---|---|
| `read` | 120/min | ordinary authenticated `GET` | user-owned rows are always filtered by local user ID |
| `mutation` | 60/min | profile, node start/complete, archive, other light writes | service validates owner and allowed aggregate state |
| `expensive` | 10/min | URL/PDF/Module create, retries, Attempt submit, adaptive decision | idempotency/submission identity plus owner/state checks |
| `stream` | 10/min | both generation SSE routes | owner checked before stream headers/snapshot |

Rate-limit rejection is `429 RATE_LIMITED` with `Retry-After`; the Redis key is never returned or
logged. CORS exposes `Retry-After` and `X-Request-Id`.

Every owned-resource operation filters by authenticated local user. A missing or foreign resource
has the same `404 NOT_FOUND` response.

| Operation | Allowed state | State failure |
|---|---|---|
| Use Source in generation | Source `ready` | `SOURCE_NOT_READY` or safe `SOURCE_PROCESSING_FAILED` |
| Retry Source | Source `failed` with retryable failure | `SOURCE_RETRY_NOT_ALLOWED` |
| Read generation/SSE | Module/intervention has a generation run | `GENERATION_NOT_AVAILABLE` |
| Retry Module generation | latest run `failed` and retryable | `GENERATION_RETRY_NOT_ALLOWED` |
| Archive Module | Module `ready` or already `archived` | `MODULE_ARCHIVE_NOT_ALLOWED` |
| Read journey | Module `ready` or `archived` | `MODULE_NOT_READY` |
| Start/complete/attempt node | Module `ready`, node unlocked | `MODULE_NOT_LEARNABLE` or `NODE_LOCKED` |
| Complete non-assessment node | no assessment activities | `ATTEMPT_REQUIRED` |
| Submit Attempt | node has assessment activities | `ACTIVITY_NOT_ASSESSABLE` |
| Decide adaptive review | intervention `offered` | `ADAPTIVE_DECISION_ALREADY_MADE` |

## Recovery, security, SSE, and observability design evidence

- One BullMQ reconciliation seam covers Source, Module, Attempt evaluation, and Adaptive jobs.
  For a nonterminal DB record it preserves waiting/active/delayed jobs, removes terminal queue jobs,
  and recreates missing/terminal jobs under the stable domain job ID.
  Each poll advances through bounded ID-ordered batches and restarts after the last batch, so
  active jobs do not prevent later records from being reconciled.
- PostgreSQL remains source of truth. Advisory locks and transactional finalization remain the
  duplicate-delivery guards; there is no outbox or migration.
- API and worker share one DNS-aware public HTTP(S) validator. Worker revalidates immediately before
  Firecrawl and validates the engine-reported `metadata.url`; `sourceURL` is the requested URL.
  This checks the returned content URL after fetching. Prevention of non-public intermediate
  redirects and DNS rebinding during the fetch depends on Firecrawl and remains unverified.
  Firecrawl is the only fetcher and uses
  `storeInCache: false`; only HTML/XHTML and up to 500,000 Markdown code points are accepted.
  Firecrawl lockdown is intentionally omitted because it is cache-only and fails on fresh cache
  misses, as documented in the [Firecrawl lockdown documentation](https://docs.firecrawl.dev/features/lockdown).
- PDF declared media type, configured size, and `%PDF-` signature are checked; malformed transport
  failures are normalized by the product exception boundary without raw error disclosure.
- Request completion logs contain only request/user IDs, route template, allowlisted resource IDs,
  status, and latency. Worker lifecycle logs contain only domain/job IDs, retry attempt, latency,
  validation outcome, and safe failure category. Four-queue count snapshots report waiting, active,
  delayed, and failed counts. Sensitive content and credentials are excluded.
- SSE sends schema-parsed snapshot and changed progress/terminal events, heartbeats, a bounded
  lifetime, and closes on terminal state or client disconnect.

## Acceptance evidence matrix

These rows map directly to API Contract section 16. None has runtime certification in this review.

| Contract # | Scenario | Evidence class | Result |
|---:|---|---|---|
| 1 | First authenticated request creates one user and stats record | Browser/Clerk | NOT RUN |
| 2 | PDF processing gates Source use until ready | Local infrastructure/live provider | NOT RUN |
| 3 | Combine PDF, URL, and text with roles, priorities, selectors, and instruction | Live provider | NOT RUN |
| 4 | Module creation replay produces one Module | Local infrastructure | NOT RUN |
| 5 | SSE reconnect returns current snapshot and eventual terminal state | Browser/live provider | NOT RUN |
| 6 | Generation retry creates a new run without duplicate stable content | Local infrastructure/live provider | NOT RUN |
| 7 | Journey exposes next node and protects locked content | Browser/Clerk | NOT RUN |
| 8 | Repeated lesson completion awards XP and advances Core once | Local infrastructure | NOT RUN |
| 9 | Quiz answers form one immutable Attempt | Local infrastructure | NOT RUN |
| 10 | Submission replay duplicates neither mastery evidence nor XP | Local infrastructure | NOT RUN |
| 11 | Activity payloads hide evaluation configuration before submission | Browser/Clerk | NOT RUN |
| 12 | Attempt finalization updates results, mastery, progress, XP, and next action atomically | Local infrastructure | NOT RUN |
| 13 | Medium mastery offers review with a single accept/decline decision | Local infrastructure | NOT RUN |
| 14 | Low mastery requires adaptive completion before Resume Node unlock | Local infrastructure/live provider | NOT RUN |
| 15 | Adaptive completion resumes Core without changing Core totals | Local infrastructure | NOT RUN |
| 16 | Dashboard and Journey return the same authoritative next action | Browser/Clerk | NOT RUN |
| 17 | Cross-user IDs return 404 without resource disclosure | Browser/Clerk | NOT RUN |
| 18 | Provider, storage, queue, and validation failures expose safe recoverable states | Local infrastructure/live provider | NOT RUN |

## Additional M9 hardening checks

| # | Scenario | Evidence class | Result |
|---:|---|---|---|
| 1 | First Clerk request provisions one user/stats pair | Browser/Clerk | NOT RUN |
| 2 | Concurrent first requests do not duplicate identity | Local infrastructure | NOT RUN |
| 3 | Foreign Source/Module/Attempt/Intervention returns indistinguishable 404 | Browser/Clerk | NOT RUN |
| 4 | Text Source create and idempotent replay | Local infrastructure | NOT RUN |
| 5 | Public HTML URL processes to ready | Live provider | NOT RUN |
| 6 | Credentials, localhost, private literal, and private DNS target are rejected | Local infrastructure | NOT RUN |
| 7 | Redirect/final URL to a non-public address is rejected | Live provider | NOT RUN |
| 8 | Non-HTML and over-500,000-code-point URL results fail non-retryably | Live provider | NOT RUN |
| 9 | Valid, malformed, wrong-media, and oversized PDF outcomes are safe | Local infrastructure | NOT RUN |
| 10 | Module generation streams snapshot/progress/completed | Live provider | NOT RUN |
| 11 | Adaptive generation streams snapshot/progress/failed or completed | Live provider | NOT RUN |
| 12 | Redis limits each user/category and returns 429 plus Retry-After | Local infrastructure | NOT RUN |
| 13 | Limiter fails open while readiness reports Redis down | Local infrastructure | NOT RUN |
| 14 | Missing BullMQ jobs for all four domains are recreated | Local infrastructure | NOT RUN |
| 15 | Active jobs are preserved and terminal/nonterminal mismatches are requeued | Local infrastructure | NOT RUN |
| 16 | Duplicate delivery does not duplicate content, progress, mastery, or XP | Local infrastructure | NOT RUN |
| 17 | XP ledger and duplicate mastery/progress release query passes candidate DB | Local infrastructure | NOT RUN |
| 18 | Logs and queue snapshots contain allowlisted metadata and no sensitive content | Local infrastructure | NOT RUN |

The full v1 exit evidence is therefore not satisfied by this static-only run.
