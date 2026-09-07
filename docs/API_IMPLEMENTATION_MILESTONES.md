> Adaptive policy update (2026-09-07): the original M7 mandatory-gating plan below is
> superseded by API_CONTRACT.md section 11. All interventions are optional, generation is
> acceptance-driven, and core progression remains independent. M7 items below are historical.

# Ngerti.in API Implementation Milestones

Status: **proposed implementation sequence**

This document divides [API_CONTRACT.md](./API_CONTRACT.md) into ordered, reviewable milestones. The
sequence starts with the smallest complete product path and adds complexity only after its public
boundary is proven.

## 1. Delivery Rules

Every milestone must:

1. use exported Zod schemas from `packages/contracts` for public request and response boundaries;
2. include the necessary migration, API/service behavior, worker behavior, and web integration for
   that slice;
3. test authorization and ownership through the public HTTP boundary;
4. test state transitions and replay/idempotency at the service or HTTP boundary;
5. use deterministic fake AI, storage, and queue adapters in automated tests;
6. keep real provider, Clerk, S3, and externally fetched URL checks as separately reported live
   evidence;
7. leave incomplete routes unmounted or feature-disabled rather than returning behavior that
   contradicts the contract;
8. preserve the stable Core Journey and keep evaluation configuration server-side.

Milestones are ordered implementation increments, not independent production releases. A milestone
may establish an internal seam used by the next milestone, but its completed behavior must remain
correct and testable.

## 2. Sequence Overview

```text
M0 Contract foundation and identity
 ↓
M1 Reusable text sources
 ↓
M2 Text-to-module asynchronous generation
 ↓
M3 PDF and URL source processing
 ↓
M4 Core learning journey and non-assessment progress
 ↓
M5 Deterministic assessment and mastery foundation
 ↓
M6 Short-answer evaluation and AI feedback
 ↓
M7 Adaptive intervention and core-journey resume
 ↓
M8 Dashboard, resume, and module lifecycle
 ↓
M9 Reliability, security, and release evidence
```

The first usable tracer is complete at M4:

```text
Sign in → paste text → generate Module → read lesson/flashcards → resume progress
```

The contract-complete v1 candidate is reached at M9.

Dependency summary:

| Milestone | Required predecessor | Primary risk retired |
|---|---|---|
| M0 | Existing monorepo foundation | Contract, authentication, and local identity |
| M1 | M0 | Ownership, reusable input, and command idempotency |
| M2 | M1 | AI generation, queue delivery, validation, and SSE |
| M3 | M2 | Binary storage, extraction, remote fetching, and Source retry |
| M4 | M2 | Server-owned progression and exactly-once learning rewards |
| M5 | M4 | Multi-question Attempt aggregate and deterministic Mastery |
| M6 | M5 | Durable AI-assisted evaluation and feedback |
| M7 | M2, M5, M6 | Adaptive policy, generation, and Core Journey resume |
| M8 | M4, M7 | Cross-session continuation and Module lifecycle |
| M9 | M0–M8 | System-wide recovery, security, and release confidence |

M3 and M4 are technically independent after M2 and may be implemented in parallel when separate
owners are available. The recommended single-team delivery order remains M3 before M4 so Source
creation is contract-complete before learning behavior expands.

## 3. Milestone 0 — Contract Foundation and Identity

### Outcome

An authenticated web request reaches `/api/v1`, resolves exactly one local user, and reads or
updates that user's local profile and stats through validated shared contracts.

### Work packages

#### M0.1 — Freeze blocking product decisions

- Confirm or revise the proposed defaults in API Contract section 17.
- Confirm that a Module may have a null title until generation succeeds.
- Confirm node-level Attempt semantics and the `attempt_responses` model.
- Confirm optional-review `offered` state and default timezone behavior.
- Mark the accepted API Contract status as `v1 baseline`.

#### M0.2 — Establish common HTTP contracts

- Add identifiers, timestamps, success envelopes, pagination, and error schemas.
- Add stable public error-code definitions.
- Configure the `/api/v1` prefix without changing `/health/*`.
- Add request ID propagation and `private, no-store` response policy.
- Map Zod validation errors and known domain errors to the public error envelope.

#### M0.3 — Authenticate and resolve ownership identity

- Add Clerk bearer-token verification as a reusable NestJS guard.
- Resolve or create one local `users` row per `clerk_user_id`.
- Create the related `user_stats` record idempotently.
- Establish an ownership helper that returns `404` for absent or foreign resources.

#### M0.4 — Implement profile endpoints

- Add `users.timezone` with a documented default.
- Implement `GET /api/v1/me`.
- Implement `PATCH /api/v1/me` for `displayName` and IANA timezone.
- Validate API responses in the web transport layer.

#### M0.5 — Establish public-seam test infrastructure

- Add authenticated and unauthenticated API test fixtures.
- Add isolated PostgreSQL test setup and migration verification.
- Add contract parsing helpers for both API and web tests.
- Prove that invalid input, missing auth, and raw exceptions use the correct public error shape.

### Exit evidence

- First authenticated request creates one user and one stats record.
- Repeated and concurrent first requests do not duplicate either record.
- Invalid or expired auth returns `401`.
- `GET /me` and `PATCH /me` round-trip through exported Zod schemas.
- Invalid timezone returns `422` with a field error.
- Existing liveness and readiness checks still pass.

### Explicitly deferred

Sources, modules, queues, AI calls, learning progress, and dashboard aggregation.

## 4. Milestone 1 — Reusable Text Sources

### Outcome

A learner can paste learning material, receive a ready reusable Source, and safely list or inspect
only their own Sources.

### Work packages

#### M1.1 — Add source and command-idempotency contracts

- Add public Source DTOs and list/create/query schemas.
- Add durable command-idempotency storage and repository behavior.
- Define payload hashing, replay, retention, and conflict semantics.

#### M1.2 — Implement text Source creation

- Implement `POST /api/v1/sources/text`.
- Normalize and validate title and text length without changing learning meaning.
- Persist text separately from any future Generation Instruction.
- Return a browser-safe Source without raw text, content hash, or internal metadata.

#### M1.3 — Implement Source reads

- Implement `GET /api/v1/sources` with cursor pagination and filters.
- Implement `GET /api/v1/sources/:sourceId`.
- Apply ownership hiding consistently.

#### M1.4 — Add the first create-module UI slice

- Add the pasted-text input and source-library selection UI.
- Show validation and idempotent retry behavior.
- Keep module submission disabled until M2.

### Exit evidence

- Creating valid text returns `201` and `status = ready`.
- Empty or oversized text returns `422` and creates no Source.
- Replaying the same idempotency key returns the original Source.
- Reusing a key with changed text returns `409 IDEMPOTENCY_CONFLICT`.
- Pagination is stable when multiple Sources have equal timestamps.
- Cross-user Source reads return `404`.

### Explicitly deferred

PDF upload, URL fetching, Source retry, Module generation, and Source deletion.

## 5. Milestone 2 — Text-to-Module Asynchronous Generation

### Outcome

A learner can generate a complete, validated Module asynchronously from one or more ready text
Sources and observe progress until the Module is ready or failed.

### Work packages

#### M2.1 — Align Module and generation persistence

- Allow a generating or failed Module title to be null and enforce a title for ready/archived state.
- Enforce one Module per Generation Request.
- Add unique Core Node, Activity, and generation-step ordering constraints.
- Use queued Generation Runs as durable queue-dispatch records.
- Add any generation idempotency constraints required by worker replay.

#### M2.2 — Add generation public contracts

- Add create/list/detail/status/SSE/retry schemas.
- Add Source role, priority, selector, and Generation Instruction validation.
- Map internal generation steps to stable product-facing phases.

#### M2.3 — Create Module generation command

- Implement `POST /api/v1/modules`.
- Validate ownership and ready state for every referenced Source.
- Require at least one primary Source and deterministic priorities.
- Atomically create Generation Request, Module, queued Generation Run, and steps.

#### M2.4 — Implement the module-generation worker

- Resolve selected Source content without copying it into the queue payload.
- Implement material analysis, concept map, curriculum, activity generation, and transactional
  finalization stages.
- Use LangChain chat-model capabilities and Zod-backed structured output schemas.
- Parse each model response once and persist only schema-conformant Core Nodes and browser-safe
  Activity content.
- Initialize owner progress in the same transaction that marks the Module ready.

#### M2.5 — Expose status and recovery

- Implement module list/detail and generation status endpoints.
- Implement snapshot-first authenticated SSE.
- Implement failed-generation retry using the same Module and a new Generation Run.
- Sanitize all failures and expose only stable retryability information.

#### M2.6 — Add generation web flow

- Enable Module submission from selected text Sources.
- Render queued, processing, phase, ready, and failed states.
- Reconnect SSE with bounded backoff and polling fallback.
- Route a ready Module to its journey shell, even though learning actions arrive in M4.

### Exit evidence

- `POST /modules` returns `202` without waiting for AI completion.
- Same command idempotency key creates one Generation Request, Module, and Generation Run.
- Duplicate worker delivery does not duplicate Concepts, Nodes, or Activities.
- Invalid AI output cannot make a Module ready.
- Pre-submission Activity DTOs contain no evaluation configuration.
- Disconnecting and reconnecting SSE returns an authoritative snapshot.
- Failed generation remains visible and retry creates a new run without a new Module.
- Automated tests use a deterministic fake model; any real-provider smoke test is reported separately.

### Explicitly deferred

PDF/URL Sources, interactive learning writes, assessment submission, adaptation, and Dashboard
aggregation.

## 6. Milestone 3 — PDF and URL Source Processing

### Outcome

The create flow supports all v1 Source types. PDF and URL Sources are processed asynchronously,
produce a visible terminal state, and can be retried safely when failure is recoverable.

### Work packages

#### M3.1 — Add Source-processing persistence and contracts

- Persist structured safe Source failure category and retryability.
- Add durable Source-processing job identity and replay safeguards.
- Add PDF multipart, URL creation, and Source retry contracts.

#### M3.2 — Implement PDF ingestion

- Validate configured size, MIME declaration, and PDF signature.
- Store the binary through the storage abstraction before acknowledging acceptance.
- Extract normalized content by page and preserve page numbers.
- Detect encrypted, malformed, empty, and text-unextractable PDFs.

#### M3.3 — Implement URL ingestion

- Accept public `http` and `https` URLs only.
- Block credential-bearing, loopback, private, link-local, and otherwise disallowed targets.
- Revalidate every redirect target.
- Enforce fetch timeout, response-size, redirect-count, and content-type limits.
- Extract and normalize the main readable content.

#### M3.4 — Implement Source status and retry

- Return pending, processing, ready, or failed Source state from the existing detail endpoint.
- Implement `POST /api/v1/sources/:sourceId/retry`.
- Ensure duplicate and concurrent jobs do not duplicate `source_contents`.

#### M3.5 — Complete create-source UI

- Add PDF upload and URL input.
- Show per-Source processing, failure, and retry states.
- Allow only ready Sources to be selected for Module generation.
- Add the PDF page selector during generation-context review.

### Exit evidence

- PDF acknowledgment occurs only after durable storage succeeds.
- Extracted PDF pages preserve stable ordering and page selectors select exact inclusive bounds.
- Private-network and unsafe redirect URL tests are rejected without making an outbound request.
- Failed processing remains visible and retry is idempotent.
- A Module can be generated from PDF + URL + text with role and priority semantics preserved.
- Real storage and public-URL smoke tests, if run, are reported separately from hermetic evidence.

### Explicitly deferred

OCR, authenticated pages, paywall bypass, Source deletion, and binary/content download APIs.

## 7. Milestone 4 — Core Learning Journey and Non-assessment Progress

### Outcome

A learner can open a ready Module, follow the server-selected Core Journey, complete lessons and
flashcards, earn XP once, and return to the correct next node.

### Work packages

#### M4.1 — Add Journey and node-read contracts

- Add Journey, Journey Node, Public Activity, progress, and Next Learning Action schemas.
- Implement `GET /api/v1/modules/:moduleId/journey`.
- Implement `GET /api/v1/modules/:moduleId/nodes/:nodeId`.
- Return locked node metadata in the Journey but reject direct locked-content reads.

#### M4.2 — Implement progression policy

- Determine the first available Core Node at Module finalization.
- Implement authoritative current-node selection.
- Implement `POST .../start` with idempotent transitions.
- Keep all unlock decisions on the server.

#### M4.3 — Complete non-assessment nodes

- Implement `POST .../complete` for lesson and flashcard-only nodes.
- Atomically update node progress, module progress, next-node availability, streak, and XP.
- Add XP uniqueness for user, reason, and qualifying reference.
- Calculate Module percentage only from Core Nodes.

#### M4.4 — Build the learning UI

- Render Journey state and the clear next action.
- Render lesson and flashcard activity variants.
- Preserve the current node on refresh and navigation.
- Render completed nodes as reviewable without awarding progress or XP again.

### Exit evidence

- A generating Module returns `409 MODULE_NOT_READY` for Journey reads.
- Locked node content returns `409 NODE_LOCKED`.
- Starting a node twice preserves the original timestamps.
- Completing a node twice advances progress once and awards XP once.
- Progress equals completed Core Nodes divided by total Core Nodes.
- Returning later resolves the same authoritative current node.

### Explicitly deferred

Assessment submission, Concept Mastery changes, Adaptive Nodes, final Dashboard ranking, and archive.

## 8. Milestone 5 — Deterministic Assessment and Mastery Foundation

### Outcome

Multiple-choice and true/false responses can be evaluated as one immutable node-level Attempt, with
Concept Results and Mastery updated exactly once.

This milestone establishes the assessment engine. If M7 Adaptive Intervention is not yet complete,
the public assessment route must remain feature-disabled for Modules whose policy outcome could
require an intervention; it must never silently bypass the adaptive policy.

### Work packages

#### M5.1 — Correct the Attempt aggregate

- Move Attempt identity to the assessment node level.
- Introduce `attempt_responses` keyed by Attempt and Activity.
- Add `submission_id`, `evaluation_status`, and `evaluated_at`.
- Enforce unique submission replay and deterministic attempt numbering per user/node.
- Migrate or explicitly reject any incompatible development-only Attempt data.

#### M5.2 — Implement deterministic evaluators

- Validate that every assessment Activity appears exactly once.
- Evaluate multiple-choice and true/false responses using server-only configuration.
- Produce safe Activity Results without echoing raw evaluation configuration.
- Aggregate normalized node score and Concept Results.

#### M5.3 — Implement Mastery policy seam

- Isolate the configurable Mastery update formula.
- Update mastery score, confidence, and evidence count transactionally.
- Isolate the deterministic Adaptive Policy result from AI generation.
- Define strictest-result behavior when one Attempt assesses several Concepts.

#### M5.4 — Finalize Attempt state atomically

- Persist immutable submission and responses before evaluation.
- Commit terminal result, Concept Results, Mastery, progress, XP, and policy decision exactly once.
- Implement `GET /api/v1/attempts/:attemptId`.
- Add concurrent duplicate-submission coverage.

#### M5.5 — Add deterministic quiz UI

- Render multiple-choice and true/false activities.
- Submit all node responses with one `submissionId`.
- Render score, correctness, explanations, Concept Results, and safe feedback state.
- Preserve a pending or failed evaluation state across refresh.

### Exit evidence

- A quiz with several Activities creates one Attempt and one response row per Activity.
- Missing, duplicate, foreign, or incorrectly shaped responses return `422`.
- Same `submissionId` and payload returns the original Attempt.
- Same `submissionId` with changed responses returns `409 SUBMISSION_CONFLICT`.
- Concurrent evaluation finalization changes Mastery and XP once.
- Raw correct-answer config remains absent before submission.

### Explicitly deferred

Short-answer AI grading, AI-written feedback, public adaptive intervention activation, and adaptive
content generation.

## 9. Milestone 6 — Short-answer Evaluation and AI Feedback

### Outcome

Short answers are durably accepted, evaluated with bounded asynchronous AI assistance when needed,
and produce recoverable status plus concise structured feedback.

### Work packages

#### M6.1 — Add evaluation contracts and queue flow

- Add discriminated short-answer response and result schemas.
- Add `evaluating`, `completed`, and `failed` response variants.
- Add a durable evaluation dispatch path and stable evaluation job identity.

#### M6.2 — Implement structured short-answer grading

- Load the server-only rubric and expected concepts.
- Use a bounded evaluation model through the provider abstraction.
- Validate structured output and normalize scores.
- Categorize retryable provider failure separately from invalid grading output.

#### M6.3 — Implement structured feedback

- Generate summary, strengths, and areas-to-improve from evaluated evidence.
- Exclude thresholds, prompts, provider data, and internal reasoning.
- Ensure feedback never controls Mastery or adaptive decisions.

#### M6.4 — Complete async Attempt UX

- Return `201` when evaluation completes within the request budget.
- Return `202` with an Attempt ID when evaluation continues asynchronously.
- Poll `GET /attempts/:attemptId` only for pending evaluation.
- Render safe failure and retry guidance without creating a second Attempt.

### Exit evidence

- The learner's response is durable before a `202` is returned.
- Provider timeout leaves one recoverable Attempt, not a lost or duplicate response.
- Worker retry finalizes the same Attempt once.
- Invalid structured grading cannot update Mastery.
- AI feedback is schema-valid and does not influence deterministic policy output.
- Deterministic tests use a fake evaluator; real-provider evidence is separate.

### Explicitly deferred

Adaptive content generation and learner decisions on optional review.

## 10. Milestone 7 — Adaptive Intervention and Core-journey Resume

### Outcome

Assessment results can offer optional review or require remediation, generate focused Adaptive
Nodes, and return the learner to the unchanged Core Journey.

Completing this milestone removes the temporary assessment activation restriction from M5.

### Work packages

#### M7.1 — Align Adaptive Intervention persistence

- Add `offered` to adaptive status.
- Persist whether an intervention is required.
- Enforce trigger Attempt, target Concepts, and Resume Node consistency.
- Add unique ordering for Adaptive Nodes within an intervention.

#### M7.2 — Activate deterministic adaptive policy

- Create `offered` for the optional-review range.
- Create `generating` immediately for required remediation.
- Make the strictest assessed Concept outcome authoritative.
- Keep the Resume Node locked only for required intervention.

#### M7.3 — Implement optional-review decision

- Implement `POST /api/v1/adaptive-interventions/:id/decision`.
- Make accept/decline idempotent and reject contradictory later decisions.
- Queue accepted review and return the correct next action.

#### M7.4 — Generate adaptive content

- Implement the adaptive worker pipeline and structured schemas.
- Load only weak Concepts and relevant existing Module content.
- Generate a narrow review/practice/remedial sequence.
- Validate that no Core Node is inserted, updated, deleted, or reordered.

#### M7.5 — Expose adaptive state and events

- Implement Adaptive Intervention detail.
- Implement snapshot-first adaptive generation SSE.
- Insert Adaptive Nodes into the returned user-specific display Journey.
- Reuse node start, completion, and Attempt endpoints.

#### M7.6 — Complete and resume

- Mark the intervention complete after its final required node.
- Award adaptive XP once.
- Unlock and select the Resume Node atomically.
- Render offer, waiting, adaptive learning, failure, completion, and resumed Core Journey in web.

### Exit evidence

- Mastery `>= 0.75` continues without an intervention.
- Mastery from `0.50` to below `0.75` creates one optional offer.
- Declining an optional offer remains declined after refresh.
- Mastery below `0.50` creates one required intervention and locks the Resume Node.
- Duplicate jobs do not duplicate Adaptive Nodes.
- Completing adaptive content unlocks the same Resume Node recorded at creation.
- Core positions, total Core Nodes, and completed Core percentage remain unchanged.

### Explicitly deferred

Advanced adaptive policies, spaced repetition, curriculum rewriting, and abandoning an accepted
optional intervention.

## 11. Milestone 8 — Dashboard, Resume, and Module Lifecycle

### Outcome

The learner lands on a useful Dashboard, sees the most relevant next action, resumes after returning,
and can inspect or archive Modules without breaking progress history.

### Work packages

#### M8.1 — Complete Module queries

- Finalize Module list filters, cursor ordering, and archived visibility.
- Finalize Module detail across generating, ready, failed, and archived states.
- Add indexes proven necessary by query plans for owner/status/update ordering.

#### M8.2 — Implement Dashboard aggregation

- Implement `GET /api/v1/dashboard`.
- Apply the contract's Continue Learning priority order.
- Return a bounded Module preview and current stats in one response.
- Avoid N+1 progress and next-action queries.

#### M8.3 — Implement archive behavior

- Implement `POST /api/v1/modules/:moduleId/archive`.
- Preserve read-only Journey and history access.
- Reject new start, completion, or Attempt commands for archived Modules.
- Remove archived Modules from Continue Learning.

#### M8.4 — Complete navigation and resume UX

- Make Dashboard the authenticated landing route.
- Route every `NextLearningAction` variant to its correct screen.
- Handle no Module, generating, failed, ready, adaptive, and completed states.
- Confirm refresh and a new session resolve the same server-selected destination.

### Exit evidence

- Required/in-progress Adaptive Intervention outranks Core Module continuation.
- Most recently active ready Module is selected deterministically.
- Empty account shows Create Module as the primary action.
- Archived Module is readable but absent from continuation and rejects writes.
- Dashboard query count remains bounded as Module count grows.
- Streak dates use the user's configured timezone.

### Explicitly deferred

Public Module discovery, sharing, social features, teacher views, and deletion/retention workflows.

## 12. Milestone 9 — Reliability, Security, and Release Evidence

### Outcome

Every v1 contract path has reproducible evidence for correctness, retry safety, authorization,
failure recovery, and browser integration.

### Work packages

#### M9.1 — Close endpoint and error-code coverage

- Map every endpoint in API Contract section 5 to at least one success and one failure test.
- Exercise every state/authorization-matrix row.
- Verify stable error codes and generic client fallbacks.
- Confirm every API response parses through the exported contract schema.

#### M9.2 — Prove duplicate-delivery safety

- Run concurrent idempotency-key tests.
- Redeliver Source, Module, evaluation, and adaptive jobs.
- Re-run finalization transactions after simulated process crashes.
- Reconcile XP ledger with cached total XP.
- Verify no duplicate mastery evidence or progress advancement.

#### M9.3 — Prove dependency-failure recovery

- Simulate PostgreSQL, Redis, storage, URL, and AI-provider failures at safe boundaries.
- Verify accepted work remains durable through queued-record recovery.
- Verify permanent failures stop retrying and remain visible.
- Verify retry endpoints reject non-retryable and invalid states.

#### M9.4 — Complete security hardening

- Test cross-user access for every resource route.
- Test PDF signatures, file limits, and malformed multipart input.
- Test URL DNS/redirect rebinding defenses and response limits.
- Confirm bearer tokens never enter SSE query strings or logs.
- Confirm raw prompts, provider payloads, storage keys, stack traces, and evaluation config never enter
  public responses.
- Add and test endpoint-appropriate rate limits.

#### M9.5 — Complete observability

- Emit structured logs with request, user, Module, Generation Run, job, and intervention correlation
  where appropriate.
- Record generation/evaluation latency, retries, validation outcome, and safe error category.
- Add queue-depth and failed-job visibility.
- Verify logs omit Source content, learner answers, tokens, and credentials by default.

#### M9.6 — Run release gates

- Run migration consistency, build, typecheck, lint, format, API integration, worker integration, and
  web end-to-end tests.
- Run the 18 public acceptance scenarios from API Contract section 16.
- Record which checks are hermetic, local-infrastructure, or owner-run live evidence.
- Keep provider traffic, production credentials, deployment, publication, and destructive cleanup
  outside automated gates unless separately authorized.

### Exit evidence

- Every contract endpoint and stable error code has traceable test evidence.
- Duplicate commands/jobs preserve all uniqueness and ledger invariants.
- SSE reconnection, polling fallback, and terminal closure pass browser tests.
- Failure injection leaves no accepted work permanently stranded.
- Cross-user resource tests return `404` consistently.
- Full repository quality gates pass from a clean checkout.

### Explicitly deferred

All v1 non-goals from the PRD, plus production deployment, live-provider certification, load testing
targets, and data-deletion policy unless separately scoped.

## 13. Endpoint-to-Milestone Map

| Endpoint | First complete milestone |
|---|---|
| `GET /health/live` | Existing foundation, regression in M0 |
| `GET /health/ready` | Existing foundation, regression in M0 |
| `GET /api/v1/me` | M0 |
| `PATCH /api/v1/me` | M0 |
| `POST /api/v1/sources/text` | M1 |
| `GET /api/v1/sources` | M1 |
| `GET /api/v1/sources/:sourceId` | M1, async states completed in M3 |
| `POST /api/v1/modules` | M2 |
| `GET /api/v1/modules` | M2, lifecycle filters completed in M8 |
| `GET /api/v1/modules/:moduleId` | M2, archived behavior completed in M8 |
| `GET /api/v1/modules/:moduleId/generation` | M2 |
| `GET /api/v1/modules/:moduleId/generation/events` | M2 |
| `POST /api/v1/modules/:moduleId/generation/retry` | M2 |
| `POST /api/v1/sources/url` | M3 |
| `POST /api/v1/sources/pdf` | M3 |
| `POST /api/v1/sources/:sourceId/retry` | M3 |
| `GET /api/v1/modules/:moduleId/journey` | M4, adaptive display completed in M7 |
| `GET /api/v1/modules/:moduleId/nodes/:nodeId` | M4 |
| `POST /api/v1/modules/:moduleId/nodes/:nodeId/start` | M4 |
| `POST /api/v1/modules/:moduleId/nodes/:nodeId/complete` | M4, adaptive completion in M7 |
| `POST /api/v1/modules/:moduleId/nodes/:nodeId/attempts` | M5, short answer in M6, adaptive activation in M7 |
| `GET /api/v1/attempts/:attemptId` | M5, async evaluation in M6 |
| `POST /api/v1/adaptive-interventions/:interventionId/decision` | M7 |
| `GET /api/v1/adaptive-interventions/:interventionId` | M7 |
| `GET /api/v1/adaptive-interventions/:interventionId/generation/events` | M7 |
| `GET /api/v1/dashboard` | M8 |
| `POST /api/v1/modules/:moduleId/archive` | M8 |

## 14. Release Gates

| Gate | Milestone | Demonstrable capability |
|---|---|---|
| Foundation | M0 | Authenticated identity and profile |
| First input | M1 | Reusable pasted-text Source |
| Generation tracer | M2 | Text Source becomes a validated ready Module |
| Complete input | M3 | PDF, URL, and text generation context |
| First learning tracer | M4 | Lesson/flashcard journey with durable progress |
| Assessment engine | M6 | All v1 question types evaluate and persist safely |
| Adaptive journey | M7 | Weakness triggers focused reinforcement and resume |
| Product-complete UI | M8 | Dashboard-to-resume journey and Module lifecycle |
| v1 candidate | M9 | Contract, reliability, security, and quality evidence complete |

No gate implies production deployment, push, release, or live-provider certification unless those
actions are separately requested and evidenced.
