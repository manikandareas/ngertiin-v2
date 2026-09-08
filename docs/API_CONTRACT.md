# Ngerti.in API Contract

Status: **accepted v1 baseline**

Audience: web, API, worker, and contract-package implementers

## 1. Purpose and Authority

This document translates the product, user-flow, business-rule, AI-generation, architecture, and
database documents into the HTTP contract required by the Ngerti.in v1 web application.

It is intentionally product-facing:

- clients work with sources, modules, learning nodes, attempts, and adaptive interventions;
- generation requests, generation runs, queue jobs, evaluation configuration, and provider details
  remain server implementation details;
- all authorization, progression, mastery, adaptive, XP, and state-transition rules remain
  authoritative on the server.

With this baseline accepted, request and response schemas in `packages/contracts` become
the executable source of truth. Database records must not be returned directly as API DTOs.

The recommended delivery order is defined in
[API Implementation Milestones](./API_IMPLEMENTATION_MILESTONES.md).

## 2. Contract Principles

1. Every user-owned resource is scoped to the authenticated local user.
2. Long-running source processing and content generation are asynchronous.
3. Every response needed to render a screen is safe for the browser.
4. `activities.evaluation_config`, model/provider metadata, storage keys, queue identifiers, and raw
   internal errors are never exposed.
5. Learning writes are idempotent so browser retries cannot duplicate modules, attempts, progress,
   mastery evidence, or XP.
6. One assessment submission creates one immutable Attempt for the whole assessment node.
7. Core progress is calculated only from Core Nodes.
8. Adaptive Nodes are always optional, never block Core Nodes, and cannot reorder or mutate the
   core journey. Generation starts only after accepting an offer.
9. Machine-readable state and error codes are stable; human-readable messages may change or be
   localized.

## 3. Protocol Conventions

### 3.1 Base URLs

```text
/health/*       public infrastructure health endpoints
/api/v1/*       authenticated product API
```

Breaking changes require a new URL version. Additive fields and new enum values are non-breaking;
clients must ignore unknown response fields and handle unknown enum values defensively.

### 3.2 Authentication

Authenticated requests use a Clerk session token:

```http
Authorization: Bearer <clerk-session-token>
```

The API verifies Clerk identity and resolves or lazily creates the corresponding local `users`
record. Credentials, OAuth identities, and password data are never stored locally.

Access to another user's resource returns `404 NOT_FOUND`, not `403`, so resource existence is not
disclosed. A valid user attempting a globally forbidden operation may receive `403`.

### 3.3 Media Types and Naming

- JSON requests and responses use `application/json; charset=utf-8`.
- PDF upload uses `multipart/form-data`.
- SSE uses `text/event-stream`.
- JSON fields use `camelCase`.
- Enum values use lowercase `snake_case`.
- IDs are UUID strings.
- Timestamps are UTC RFC 3339 strings, for example `2026-09-03T08:15:30.000Z`.
- Calendar dates use `YYYY-MM-DD`.
- Scores from `0` to `1` are JSON numbers, not numeric strings.
- Absent optional values are omitted. A field is `null` only when the contract explicitly allows it.

### 3.4 Success Envelopes

Single-resource response:

```json
{
  "data": {}
}
```

Cursor-paginated response:

```json
{
  "data": [],
  "pageInfo": {
    "nextCursor": "opaque-or-null",
    "hasNextPage": false
  }
}
```

List ordering must be deterministic. Cursors are opaque and must not be constructed or interpreted
by the client.

### 3.5 Idempotency

The following commands require an `Idempotency-Key` header:

- source creation;
- module creation;
- source or generation retry;
- optional-review decision.

The key is scoped to authenticated user, HTTP method, and canonical route. Reusing a key with the
same normalized payload replays the original status and response. Reusing it with a different
payload returns `409 IDEMPOTENCY_CONFLICT`.

Attempt submission uses a required `submissionId` UUID in the body because that identifier also
belongs to the immutable Attempt record. Node start and completion are naturally idempotent for a
user/node pair.

### 3.6 Error Shape

All product API errors use this shape:

```json
{
  "type": "https://api.ngerti.in/problems/validation-error",
  "title": "Request validation failed",
  "status": 422,
  "code": "VALIDATION_ERROR",
  "detail": "One or more fields are invalid.",
  "instance": "/api/v1/modules",
  "requestId": "req_01K4...",
  "errors": [
    {
      "path": "sources.0.sourceId",
      "code": "invalid_uuid",
      "message": "Expected a UUID."
    }
  ]
}
```

`errors` is present only for field-level validation. Internal stack traces, provider responses,
storage keys, prompts, and queue details must never appear in this response.

Status-code policy:

| Status | Meaning |
|---|---|
| `400` | Malformed JSON, invalid cursor, or structurally unreadable request |
| `401` | Missing, expired, or invalid authentication |
| `403` | Authenticated but globally forbidden operation |
| `404` | Resource absent or not owned by the caller |
| `409` | Valid command conflicts with current resource state or idempotency record |
| `413` | Uploaded source exceeds configured size limit |
| `415` | Unsupported media type |
| `422` | Request schema or cross-field validation failed |
| `429` | Rate limit exceeded |
| `500` | Unexpected internal error |
| `503` | A required dependency is temporarily unavailable |

### 3.7 Cache and Correlation

Authenticated responses use `Cache-Control: private, no-store` unless a future endpoint explicitly
states otherwise. Every response includes `X-Request-Id`; the client may send the same header to
correlate its logs, but the server may replace invalid values.

Health endpoints are exceptions to the product envelope and authentication rules. Their existing
raw responses remain:

```ts
type LiveHealth = { status: "ok"; service: "api" };

type ReadyHealth = {
  status: "ok" | "error";
  service: "api";
  dependencies: {
    postgres: "up" | "down";
    redis: "up" | "down";
    storage: "up" | "down";
  };
};
```

Readiness returns `200` when all dependencies are up and `503` with the same raw shape when any
dependency is down.

## 4. Shared Domain DTOs

The examples below define public shapes, not database row shapes.

### 4.1 Current User

```ts
type CurrentUser = {
  id: string;
  displayName: string | null;
  timezone: string;
  stats: {
    totalXp: number;
    currentStreak: number;
    longestStreak: number;
    lastLearningDate: string | null;
  };
};
```

`timezone` is an IANA timezone such as `Asia/Makassar`. It controls streak-day boundaries.

### 4.2 Source

```ts
type SourceType = "pdf" | "url" | "text";
type SourceStatus = "pending" | "processing" | "ready" | "failed";

type Source = {
  archivedAt: string | null; // ISO timestamp; null means active
  retriesRemaining: number; // 0..2; text sources always 0
  id: string;
  type: SourceType;
  title: string | null;
  status: SourceStatus;
  originalFilename?: string;
  originalUrl?: string;
  sizeBytes?: number;
  pageCount?: number;
  failure?: {
    code: string;
    message: string;
    retryable: boolean;
  };
  createdAt: string;
  updatedAt: string;
};
```

Source content, extracted text, content hashes, storage keys, and raw metadata are private.

### 4.3 Module Summary

```ts
type ModuleStatus = "generating" | "ready" | "failed" | "archived";
type ModuleProgressStatus = "not_started" | "in_progress" | "completed";

type ModuleSummary = {
  id: string;
  title: string | null;
  description: string | null;
  difficulty: "beginner" | "intermediate" | "advanced" | null;
  status: ModuleStatus;
  estimatedMinutes: number | null;
  progress: {
    status: ModuleProgressStatus;
    percentage: number;
    completedCoreNodes: number;
    totalCoreNodes: number;
  } | null;
  nextAction: NextLearningAction;
  createdAt: string;
  updatedAt: string;
};
```

`title` may be `null` while generation has not yet produced valid module metadata. It must be
non-null when the module becomes `ready`.

### 4.4 Next Learning Action

```ts
type NextLearningAction =
  | { type: "wait_for_module"; moduleId: string }
  | { type: "retry_module"; moduleId: string }
  | { type: "start_core_node" | "resume_core_node"; moduleId: string; nodeId: string }
  | { type: "offer_optional_review"; attemptId: string; interventionId: string }
  | { type: "wait_for_adaptive"; interventionId: string }
  | { type: "start_adaptive_node" | "resume_adaptive_node"; moduleId: string; nodeId: string }
  | { type: "module_completed"; moduleId: string }
  | { type: "none" };
```

The client follows `nextAction`; it must not recreate unlock, mastery, or adaptive policy logic.

### 4.5 Generation Status

```ts
type GenerationState = "queued" | "processing" | "completed" | "failed";

type GenerationPhase =
  | "preparing_sources"
  | "understanding_material"
  | "creating_concepts"
  | "creating_journey"
  | "generating_activities"
  | "validating_content";

type GenerationStatus = {
  retriesRemaining: number; // 0..2 for module generation; 0 for adaptive
  state: GenerationState;
  progressPercentage: number;
  currentPhase: GenerationPhase | null;
  phases: Array<{
    phase: GenerationPhase;
    status: "pending" | "processing" | "completed" | "failed";
  }>;
  failure: {
    code: string;
    message: string;
    retryable: boolean;
  } | null;
  startedAt: string | null;
  finishedAt: string | null;
};
```

Phase names are stable product concepts. Internal step names may differ and are mapped by the API.

### 4.6 Journey and Node

```ts
type NodeProgressStatus = "locked" | "available" | "in_progress" | "completed";

type JourneyNode = {
  id: string;
  origin: "core" | "adaptive";
  type:
    | "lesson"
    | "flashcard"
    | "quiz"
    | "checkpoint"
    | "review"
    | "practice"
    | "remedial_quiz";
  title: string;
  description: string | null;
  position: number;
  progress: {
    status: NodeProgressStatus;
    bestScore: number | null;
    attemptCount: number;
  };
  interventionId?: string;
};
```

Core and adaptive positions are local to their respective sequences. The API returns journey items
in the exact display order for the current user.

### 4.7 Browser-safe Activities

```ts
type PublicActivity =
  | {
      id: string;
      type: "lesson";
      position: number;
      content: {
        format: "markdown";
        title: string;
        body: string; // Whole Markdown document; images reference visual-1 / visual-2.
        images: Array<{
          id: string;
          url: string; // Signed URL, expires after 15 minutes.
          fileTitle: string;
          width: number;
          height: number;
          caption: string;
          alt: string;
          creator: string;
          sourceUrl: string;
          license: string;
          licenseVersion: string;
          licenseUrl: string;
        }>;
      } | { // Legacy lesson content remains readable.
        introduction?: string;
        explanation: string;
        keyPoints: string[];
        examples?: string[];
        summary?: string;
      };
    }
  | {
      id: string;
      type: "flashcard";
      position: number;
      content: {
        cards: Array<{ front: string; back: string; conceptKey: string }>;
      };
    }
  | {
      id: string;
      type: "multiple_choice";
      position: number;
      content: { question: string; options: string[] };
    }
  | {
      id: string;
      type: "true_false";
      position: number;
      content: { statement: string };
    }
  | {
      id: string;
      type: "short_answer";
      position: number;
      content: { prompt: string };
    };
```

No pre-submission payload may reveal correct answers, explanations, rubrics, expected concepts, or
concept weights used for grading.

## 5. Endpoint Summary

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health/live` | Process liveness |
| `GET` | `/health/ready` | API dependency readiness |
| `GET` | `/api/v1/me` | Current profile and stats |
| `GET` | `/api/v1/me/usage` | Current weekly quotas and active module generation |
| `PATCH` | `/api/v1/me` | Update local profile preferences |
| `GET` | `/api/v1/dashboard` | Continue-learning card and module preview |
| `POST` | `/api/v1/sources/text` | Create a ready pasted-text source |
| `POST` | `/api/v1/sources/url` | Create and queue URL processing |
| `POST` | `/api/v1/sources/pdf` | Upload and queue PDF processing |
| `GET` | `/api/v1/sources` | List reusable sources |
| `GET` | `/api/v1/sources/:sourceId` | Read source status and metadata |
| `POST` | `/api/v1/sources/:sourceId/retry` | Retry failed source processing |
| `POST` | `/api/v1/modules` | Create a generation request and start module generation |
| `GET` | `/api/v1/modules` | List modules |
| `GET` | `/api/v1/modules/:moduleId` | Read module summary |
| `GET` | `/api/v1/modules/:moduleId/generation` | Read module generation status |
| `GET` | `/api/v1/modules/:moduleId/generation/events` | Stream module generation status |
| `POST` | `/api/v1/modules/:moduleId/generation/retry` | Retry a failed module generation |
| `POST` | `/api/v1/modules/:moduleId/archive` | Archive a ready module |
| `GET` | `/api/v1/modules/:moduleId/journey` | Read the user-specific journey |
| `GET` | `/api/v1/modules/:moduleId/nodes/:nodeId` | Read an unlocked node and activities |
| `POST` | `/api/v1/modules/:moduleId/nodes/:nodeId/start` | Mark a node in progress |
| `POST` | `/api/v1/modules/:moduleId/nodes/:nodeId/complete` | Complete a non-assessment node |
| `POST` | `/api/v1/modules/:moduleId/nodes/:nodeId/attempts` | Submit one assessment attempt |
| `GET` | `/api/v1/attempts/:attemptId` | Read evaluation state and result |
| `POST` | `/api/v1/adaptive-interventions/:interventionId/decision` | Accept or decline optional review |
| `GET` | `/api/v1/adaptive-interventions/:interventionId` | Read adaptive state and nodes |
| `GET` | `/api/v1/adaptive-interventions/:interventionId/generation/events` | Stream adaptive generation status |

Resource deletion, source-content download, module editing, public sharing, and administrative APIs
are outside v1 scope.

## 6. User and Dashboard

### 6.1 Get Current User

```http
GET /api/v1/me
```

Returns `200` with `CurrentUser` and ensures the local user and stats records exist.

### 6.2 Update Profile

```http
PATCH /api/v1/me
Content-Type: application/json

{
  "displayName": "Vito",
  "timezone": "Asia/Makassar"
}
```

Both fields are optional, but at least one must be supplied. `displayName` may be explicitly set to
`null`; `timezone` must be a valid IANA timezone. Returns `200` with `CurrentUser`.

### 6.3 Dashboard

```http
GET /api/v1/dashboard
```

```json
{
  "data": {
    "continueLearning": {
      "module": {
        "id": "927a801b-691a-4fdb-9fe1-9328ad6d4381",
        "title": "Digestive System",
        "description": "A guided introduction to human digestion.",
        "difficulty": "intermediate",
        "status": "ready",
        "estimatedMinutes": 55,
        "progress": {
          "status": "in_progress",
          "percentage": 72,
          "completedCoreNodes": 5,
          "totalCoreNodes": 7
        },
        "nextAction": {
          "type": "resume_core_node",
          "moduleId": "927a801b-691a-4fdb-9fe1-9328ad6d4381",
          "nodeId": "0a3db70d-3798-4109-b93e-b53664593f29"
        },
        "createdAt": "2026-09-02T04:10:00.000Z",
        "updatedAt": "2026-09-03T06:30:00.000Z"
      }
    },
    "modules": [],
    "stats": {
      "totalXp": 430,
      "currentStreak": 4,
      "longestStreak": 8,
      "lastLearningDate": "2026-09-03"
    }
  }
}
```

`continueLearning` is `null` when no active module exists. Selection priority is:

1. most recently updated in-progress ready Module;
2. most recently created ready, not-started Module;
3. most recent generating Module;
4. `null`.

Archived modules and failed modules are omitted from `continueLearning`. `modules` is a bounded
preview ordered by `updatedAt DESC, id DESC`; the full collection comes from `GET /modules`.

## 7. Sources

### 7.1 Create Text Source

```http
POST /api/v1/sources/text
Idempotency-Key: 018f0df2-f35a-7c12-9dd2-ff7f5d3ef9aa
Content-Type: application/json

{
  "title": "My digestion notes",
  "text": "Digestion begins in the mouth..."
}
```

Validation:

- `text` is trimmed and must remain non-empty;
- `title` is optional;
- configured text and title length limits are enforced before persistence.

Returns `201` with a `Source` whose status is `ready`. Text normalization is part of this request in
v1; changing it to asynchronous processing would be a future contract change.

### 7.2 Create URL Source

```http
POST /api/v1/sources/url
Idempotency-Key: 018f0df2-f35a-7c12-9dd2-ff7f5d3ef9ab
Content-Type: application/json

{
  "title": "Reference article",
  "url": "https://example.com/digestion"
}
```

Returns `202` with a `pending` Source and queues source processing.

Only public `http` and `https` URLs are accepted. The fetcher must reject credentials in URLs,
localhost, and literal or DNS-resolved private, loopback, link-local, multicast, and reserved
addresses, including the final URL after redirects. URL processing accepts HTML/XHTML only and at
most 500,000 Unicode code points of normalized Markdown. These limits are accepted v1 defaults;
violations fail safely without retrying.

### 7.3 Create PDF Source

```http
POST /api/v1/sources/pdf
Idempotency-Key: 018f0df2-f35a-7c12-9dd2-ff7f5d3ef9ac
Content-Type: multipart/form-data

file=<binary PDF>
title=Biology Grade 11
```

Returns `202` with a `pending` Source after durable object storage succeeds and source processing is
queued. The API validates both declared MIME type and PDF signature. Encrypted, malformed, empty,
or oversized PDFs fail with a specific safe error.

OCR for image-only PDFs is not guaranteed by this v1 contract. Such a source may fail with
`SOURCE_TEXT_NOT_EXTRACTABLE`.

### 7.4 List and Read Sources

```http
GET /api/v1/sources?type=pdf&status=ready&limit=20&cursor=<opaque>
GET /api/v1/sources/:sourceId
```

Supported filters are `type`, `status`, `q` (case-insensitive literal title, filename, or URL search),
and `archived=true|false` (default `false`). `q` is trimmed and capped at 500 characters.
`limit` defaults to `20` and is capped at `100`.
Ordering is `createdAt DESC, id DESC`.

The detail endpoint is the polling fallback for source processing. Clients should back off while
status is `pending` or `processing`.

### 7.5 Retry Source Processing

```http
POST /api/v1/sources/:sourceId/retry
Idempotency-Key: 018f0df2-f35a-7c12-9dd2-ff7f5d3ef9ad
```

Allowed only when `archivedAt = null`, `status = failed`, and `failure.retryable = true`. Returns `202` with the Source in
`pending`. Otherwise returns `409 SOURCE_RETRY_NOT_ALLOWED`. A PDF/URL Source has at most two
lifetime manual retries; exhaustion returns `409 RETRY_LIMIT_EXCEEDED`. Worker retries do not
create processing runs and do not consume manual retries.

### 7.6 Edit, Rename, Archive, and Restore

```http
PATCH /api/v1/sources/:sourceId
Content-Type: application/json

{ "title": "New display title", "archived": true }
```

Optional `text` updates the content of a text source only; PDF/URL edits return `422 VALIDATION_ERROR`.
Text is trimmed, must be nonempty, and is limited to 100,000 Unicode code points.
Updating text also updates its content hash; existing generated modules are not regenerated.

At least one field is required. `title` is trimmed, must not be empty, and is capped at 200 Unicode
code points. `archived: false` restores the source. Returns `200 { data: Source }`. Rename changes
only the display title. Archive/restore preserves files, extracted content, generation relationships,
and quota usage. There is no permanent-delete endpoint.

All source operations require ownership; inaccessible resources return `404 NOT_FOUND`. Archived
sources remain readable through detail, preview, and file endpoints. Restore before retrying source
processing. Processing already underway may complete without changing archive state.

### 7.7 Source Preview and Original PDF

```http
GET /api/v1/sources/:sourceId/preview
GET /api/v1/sources/:sourceId/file
```

Preview returns `{ data: { text: string | null, sections: Array<{ position: number,
pageNumber: number | null, heading: string | null, content: string }> } }`. Sections follow stored
position order. Content comes only from saved text/extraction; preview never fetches a URL again.
Pending, processing, or failed sources may have no extracted content yet.

The file endpoint is PDF-only and returns `{ data: { url: string, expiresAt: string } }` with
`Cache-Control: private, no-store`. The signed URL expires after five minutes and is generated on
demand. Clients can request another URL when the document expires. Missing/non-PDF files return
`404 NOT_FOUND`; signing failures return `503 DEPENDENCY_UNAVAILABLE`.

New module generation rejects archived sources with `409 VALIDATION_ERROR`. Source validation
holds row share locks until the generation transaction commits; archive updates acquire conflicting
row locks, so whichever operation obtains its lock first determines acceptance. Already accepted
generation and retries of existing modules continue to read archived sources.

## 8. Module Creation and Generation

### 8.1 Create Module

```http
POST /api/v1/modules
Idempotency-Key: 018f0df2-f35a-7c12-9dd2-ff7f5d3ef9ae
Content-Type: application/json

{
  "instruction": "Focus on pages 45-62 and target senior high school level.",
  "generationSettings": {
    "language": "id",
    "length": "auto",
    "activityTypes": ["lesson", "flashcard", "quiz"]
  },
  "sources": [
    {
      "sourceId": "ba60399e-f5ff-43a6-b5ad-b692bad7516e",
      "role": "primary",
      "priority": 1,
      "selector": {
        "pages": { "from": 45, "to": 62 }
      }
    },
    {
      "sourceId": "f1549457-ce46-4230-bc87-d438f87498d1",
      "role": "reference",
      "priority": 2
    }
  ]
}
```

The command atomically creates the internal Generation Request, Module, and module Generation Run,
then queues work. A queue-publish failure must leave a recoverable durable state; it must not lose a
successfully accepted request.

Validation and policy:

- one to the configured maximum number of distinct sources is required;
- every source must be owned by the caller and have `status = ready`;
- at least one source must have `role = primary`;
- role authority is `primary`, then `reference`, then `supplementary`;
- an explicit Generation Instruction may narrow or clarify how those roles are applied, but cannot
  bypass ownership, readiness, selector, or content-safety rules;
- `priority` is an integer from `1` to `100`; lower numbers have higher priority within a role;
- priorities must be unique within the request;
- v1 selectors support PDF pages only;
- `from` and `to` are inclusive, positive, and `from <= to`;
- the selected pages must exist in the processed PDF;
- selector is forbidden for URL and text sources;
- instruction is optional and stored separately from source content.
- `generationSettings` is optional. New requests normalize omitted settings/fields to
  `language: "id"`, `length: "auto"`, and `activityTypes: ["lesson", "flashcard", "quiz"]`.
  Languages: `id` (Bahasa Indonesia), `ms` (Bahasa Melayu), `en` (English).
  Length counts **all core nodes**: `auto` 1–20 (model chooses), `short` 3–5,
  `medium` 6–10, `long` 11–15.
- Activity categories must be a nonempty unique subset of `lesson | flashcard | quiz`;
  unknown values, duplicate categories, empty selections, and unknown settings fields are rejected.
  Selected categories are allowed, not required: not every category must appear.
  `lesson` permits lesson nodes/activities; `flashcard` permits flashcard nodes/activities;
  `quiz` permits quiz/checkpoint nodes and multiple_choice/true_false/short_answer activities.
  Every activity in every core node must belong to a selected category, including mixed nodes.
- Structured settings override conflicting free-text instructions. The chosen language governs
  generated learner content and short-answer feedback; application UI remains Indonesian.
  Adaptive content inherits only the language, permits all existing activity types, and remains 1–3 nodes.
- Normalized settings are stored in `generation_requests.generation_settings` (JSONB) and included
  in the idempotency payload hash. Category order is canonical, so checkbox order does not change
  request identity; a changed setting does. Queue payloads continue to contain IDs only.
- Retry reuses the stored request/settings; checkpoint resume reloads the same settings.
  Existing rows retain NULL and legacy behavior, including retry/resume. Existing content is not translated.
  Apply migration `0012_loving_genesis.sql` before starting the updated API/worker.


Returns `202`:

```json
{
  "data": {
    "module": {
      "id": "927a801b-691a-4fdb-9fe1-9328ad6d4381",
      "title": null,
      "description": null,
      "difficulty": null,
      "status": "generating",
      "estimatedMinutes": null,
      "progress": null,
      "nextAction": {
        "type": "wait_for_module",
        "moduleId": "927a801b-691a-4fdb-9fe1-9328ad6d4381"
      },
      "createdAt": "2026-09-03T08:15:30.000Z",
      "updatedAt": "2026-09-03T08:15:30.000Z"
    },
    "generation": {
      "state": "queued",
      "progressPercentage": 0,
      "currentPhase": null,
      "phases": [],
      "failure": null,
      "startedAt": null,
      "finishedAt": null
    }
  }
}
```

Important conflicts include `SOURCE_NOT_READY`, `SOURCE_PROCESSING_FAILED`, and
`IDEMPOTENCY_CONFLICT`.

### 8.2 List and Read Modules

```http
GET /api/v1/modules?status=ready&progressStatus=in_progress&limit=20&cursor=<opaque>
GET /api/v1/modules/:moduleId
```

Supported filters are `status`, `progressStatus`, and `q`. Multiple `status` values may be comma-separated.
`q` searches module titles and descriptions case-insensitively before pagination. It is trimmed,
limited to 500 characters, and treats `%`, `_`, and backslashes literally. Empty `q` applies no search filter.
Archived modules are excluded unless explicitly requested. Ordering is `updatedAt DESC, id DESC`.

### 8.3 Read Generation Status

```http
GET /api/v1/modules/:moduleId/generation
```

Returns the latest module-generation status. It is valid for generating, ready, or failed Modules.
A ready Module returns `completed`; a failed Module returns `failed` with a safe failure summary.

### 8.4 Stream Generation Status

```http
GET /api/v1/modules/:moduleId/generation/events
Accept: text/event-stream
Authorization: Bearer <token>
```

Because native browser `EventSource` cannot attach the required bearer header, the web client must
consume this endpoint using authenticated fetch streaming. Tokens must never be placed in the query
string.

Each connection begins with a complete snapshot, so reconnect does not require replaying every
historical event:

```text
event: generation.snapshot
data: {"state":"processing","progressPercentage":42,"currentPhase":"creating_journey","phases":[],"failure":null,"startedAt":"2026-09-03T08:15:33.000Z","finishedAt":null}

event: generation.completed
data: {"state":"completed","progressPercentage":100,"currentPhase":null,"phases":[],"failure":null,"startedAt":"2026-09-03T08:15:33.000Z","finishedAt":"2026-09-03T08:18:02.000Z"}
```

The stream sends comment heartbeats, closes after a terminal event, and may close at any time.
Clients reconnect with bounded exponential backoff and fall back to the status endpoint. PostgreSQL
state, not the SSE connection, is authoritative.

### 8.5 Retry Failed Generation

```http
POST /api/v1/modules/:moduleId/generation/retry
Idempotency-Key: 018f0df2-f35a-7c12-9dd2-ff7f5d3ef9af
```

Allowed only for an owned Module with `status = failed` and a retryable latest failure. It reuses the
same Module and Generation Request, creates a new Generation Run, transitions the Module back to
`generating`, and returns `202` with Module and Generation Status. At most two lifetime manual
retries are allowed (`409 RETRY_LIMIT_EXCEEDED`). An existing queued/processing module run for
the account blocks retry with `409 GENERATION_IN_PROGRESS` and `activeModuleId`. Retry remains
available after weekly quota exhaustion. Only `type = module` runs count toward this limit.

Completed steps and extracted sources may be reused, but partial output from a failed run must not
become user-visible or duplicate stable content.

### 8.6 Archive Module

```http
POST /api/v1/modules/:moduleId/archive
```

Allowed only when `status = ready`; returns `200` with the archived Module. Archiving is idempotent:
an already archived Module returns the same state. Archived modules remain readable but cannot start
new learning actions or Attempts.

## 9. Learning Journey

### 9.1 Get Journey

```http
GET /api/v1/modules/:moduleId/journey
```

Allowed only for a ready or archived Module. Module generation finalization initializes the owner's
module/node progress records in the same transaction that makes the Module ready, so this read does
not mutate state.

```json
{
  "data": {
    "module": {
      "id": "927a801b-691a-4fdb-9fe1-9328ad6d4381",
      "title": "Digestive System",
      "description": "A guided introduction to human digestion.",
      "difficulty": "intermediate",
      "estimatedMinutes": 55
    },
    "progress": {
      "status": "in_progress",
      "percentage": 42.86,
      "completedCoreNodes": 3,
      "totalCoreNodes": 7
    },
    "nodes": [],
    "nextAction": {
      "type": "resume_core_node",
      "moduleId": "927a801b-691a-4fdb-9fe1-9328ad6d4381",
      "nodeId": "0a3db70d-3798-4109-b93e-b53664593f29"
    }
  }
}
```

Rules:

- `nodes` is already ordered for this user and may include Adaptive Nodes at their insertion point;
- only Core Nodes contribute to `percentage`, `completedCoreNodes`, and `totalCoreNodes`;
- locked nodes expose metadata but not activity content;
- Adaptive Interventions never lock Core Nodes; `nextAction` follows the current Core Journey;
- archived journeys are read-only and return `nextAction.type = none`.

### 9.2 Get Node

```http
GET /api/v1/modules/:moduleId/nodes/:nodeId
```

Returns:

```json
{
  "data": {
    "latestCompletedAttemptId": null,
    "node": {},
    "activities": [],
    "moduleProgress": {},
    "nextAction": { "type": "none" }
  }
}
```

The node must belong to the route Module and to the current user's visible journey. Locked nodes
return `409 NODE_LOCKED`; generation-incomplete modules return `409 MODULE_NOT_READY`.

`activities` contains only the browser-safe union from section 4.7. Activity order is ascending by
position and IDs remain stable across reads.

`latestCompletedAttemptId` is the current user's completed Attempt with the highest
`attemptNumber` for this node, or `null` when none exists. It is independent of `bestScore`
and allows reopened nodes to restore their assessment summary through the Attempt read endpoint.
Opening a node does not create an Attempt or change its progress.

### 9.3 Start Node

```http
POST /api/v1/modules/:moduleId/nodes/:nodeId/start
```

Transitions `available -> in_progress`, starts module progress when this is the first Core Node, and
sets the authoritative current node. Calling it again for an in-progress or completed node returns
`200` without resetting timestamps or progress.

### 9.4 Complete Non-assessment Node

```http
POST /api/v1/modules/:moduleId/nodes/:nodeId/complete
```

Allowed only for an available or in-progress node containing no assessment activities. Completion,
next-node unlock, module progress, intervention completion when applicable, streak update, and XP
ledger writes occur atomically.

Returns `200`:

```json
{
  "data": {
    "nodeProgress": {
      "status": "completed",
      "bestScore": null,
      "attemptCount": 0
    },
    "moduleProgress": {
      "status": "in_progress",
      "percentage": 28.57,
      "completedCoreNodes": 2,
      "totalCoreNodes": 7
    },
    "xpAwarded": 10,
    "nextAction": {
      "type": "start_core_node",
      "moduleId": "927a801b-691a-4fdb-9fe1-9328ad6d4381",
      "nodeId": "0a3db70d-3798-4109-b93e-b53664593f29"
    }
  }
}
```

Repeating completion returns the already completed state with `xpAwarded = 0`.

For M4, completing a Core Node made exclusively of lesson and/or flashcard activities awards
exactly `10 XP`. The XP Event uses reason `node_completed` and the Core Node ID as its qualifying
reference; that user/reason/reference combination is unique.

## 10. Assessment Attempts

### 10.1 Submit Attempt

```http
POST /api/v1/modules/:moduleId/nodes/:nodeId/attempts
Content-Type: application/json

{
  "submissionId": "f7d398ab-536b-4ca8-ad3d-79ef3b004f65",
  "responses": [
    {
      "activityId": "20d61a35-2e36-4c96-b7ca-2237eb168f37",
      "answer": { "optionIndex": 0 }
    },
    {
      "activityId": "57ed34d4-736d-43e9-9b2a-eac93d6d0fd2",
      "answer": { "value": true }
    },
    {
      "activityId": "64b9af45-61bb-41ce-8352-00929950f26c",
      "answer": { "text": "Pepsin breaks proteins into smaller peptides." }
    }
  ]
}
```

Response variants are discriminated by activity type:

```ts
type ActivityResponse =
  | { activityId: string; answer: { optionIndex: number } }
  | { activityId: string; answer: { value: boolean } }
  | { activityId: string; answer: { text: string } };
```

Validation:

- the Module must be ready and writable;
- the node must be available or in progress and contain assessment activities;
- every assessment activity in the node must appear exactly once;
- no foreign or non-assessment activity may appear;
- option indices and answer shapes must match the referenced activity;
- short answers are trimmed, must remain non-empty, and are limited to 4,000 Unicode code points;
- Core Node availability depends only on the Core Journey; adaptive work never blocks it.

`submissionId` makes network retries safe. The same ID with the same normalized responses returns
the original Attempt. A different payload returns `409 SUBMISSION_CONFLICT`.

Deterministic-only Attempts are evaluated immediately. An Attempt containing any short answer is
dispatched to the internal `attempt-evaluation` queue and the request waits for at most five
seconds. The endpoint returns `201` when the Attempt is already `completed` or `failed`, and `202`
only while `evaluationStatus = evaluating`. In every case the Attempt and its normalized responses
are durably committed before the response is sent.

The Attempt body is a discriminated union. Fields from another lifecycle state are omitted rather
than returned as `null`:

```ts
type ActivityResult = {
  activityId: string;
  answer: { optionIndex: number } | { value: boolean } | { text: string };
  correct: boolean;
  score: number;
  maxScore: number;
  explanation: string;
};

type Attempt =
  | {
      id: string;
      submissionId: string;
      attemptNumber: number;
      evaluationStatus: "evaluating";
      createdAt: string;
    }
  | {
      id: string;
      submissionId: string;
      attemptNumber: number;
      evaluationStatus: "completed";
      score: number;
      maxScore: number;
      normalizedScore: number;
      activityResults: ActivityResult[];
      conceptResults: ConceptResult[];
      feedback: AssessmentFeedback | null;
      policyOutcome: "continue" | "optional_review" | "required_intervention"; // last value is historical only
      createdAt: string;
      evaluatedAt: string;
    }
  | {
      id: string;
      submissionId: string;
      attemptNumber: number;
      evaluationStatus: "failed";
      failure: {
        code: "ATTEMPT_EVALUATION_FAILED";
        message: string;
        retryable: boolean;
      };
      createdAt: string;
      evaluatedAt: string;
    };

type AssessmentFeedback = {
  summary: string;
  strengths: string[];
  areasToImprove: string[];
};
```

Completed response:

```json
{
  "data": {
    "attempt": {
      "id": "ba828b26-4154-4856-a75b-0d30d19517ea",
      "submissionId": "f7d398ab-536b-4ca8-ad3d-79ef3b004f65",
      "attemptNumber": 1,
      "evaluationStatus": "completed",
      "score": 8,
      "maxScore": 10,
      "normalizedScore": 0.8,
      "activityResults": [
        {
          "activityId": "20d61a35-2e36-4c96-b7ca-2237eb168f37",
          "answer": { "optionIndex": 0 },
          "correct": true,
          "score": 1,
          "maxScore": 1,
          "explanation": "Pepsin breaks proteins into smaller peptides."
        }
      ],
      "conceptResults": [
        {
          "conceptKey": "digestive_enzymes",
          "performanceScore": 0.7,
          "masteryScore": 0.62,
          "confidenceScore": 0.55,
          "evidenceCount": 2
        }
      ],
      "feedback": {
        "summary": "You identified pepsin's role and connected it to protein digestion.",
        "strengths": ["Correctly described the substrate and product."],
        "areasToImprove": ["Explain where pepsin is active and why the environment matters."]
      },
      "policyOutcome": "optional_review",
      "createdAt": "2026-09-03T09:20:00.000Z",
      "evaluatedAt": "2026-09-03T09:20:03.000Z"
    },
    "nodeProgress": {
      "status": "completed",
      "bestScore": 0.8,
      "attemptCount": 1
    },
    "moduleProgress": {
      "status": "in_progress",
      "percentage": 42.86,
      "completedCoreNodes": 3,
      "totalCoreNodes": 7
    },
    "xpAwarded": 20,
    "adaptiveInterventionId": "53aecbb3-530b-459e-aac6-7fcbb0c566aa",
    "nextAction": {
      "type": "start_core_node",
      "moduleId": "927a801b-691a-4fdb-9fe1-9328ad6d4381",
      "nodeId": "0a3db70d-3798-4109-b93e-b53664593f29"
    }
  }
}
```

Evaluation config is never echoed. M6 returns only safe correctness, score, explanation, and
learner-facing feedback; it does not expose raw correct answers, weights, rubrics, expected
Concepts, prompts sent to the provider, provider metadata, or evaluation configuration.

In M6, deterministic-only evaluation keeps overall feedback `null`. Feedback is not an input to
the adaptive policy; policy is derived only from updated Concept Mastery.
Public submission is enabled; adaptive recommendations follow the optional policy in section 11.

### 10.2 Evaluation Atomicity

Submission first commits the Attempt and immutable per-activity responses in one transaction. Once
evaluation succeeds, finalization commits these changes in a second transaction:

1. terminal Attempt evaluation and per-activity results;
2. Concept Results;
3. Mastery update;
4. node and module progress;
5. adaptive-policy decision;
6. XP Event and cached user stats.

For AI evaluation, the `evaluating` Attempt row is the durable dispatch record. The worker polls
such rows that contain short-answer responses and enqueues `attempt-evaluation` with
`jobId = attemptId`; no separate evaluation-run table is created. Finalization locks the Attempt
and becomes a no-op after either terminal state, so duplicate delivery cannot apply Mastery,
progress, or XP twice.

Submitted responses become immutable immediately. Only evaluation lifecycle and result fields may
advance from `evaluating` to one terminal state. If asynchronous evaluation fails, the Attempt ends
with `evaluationStatus = failed`; `GET /attempts/:attemptId` returns a safe retryable failure.
Evaluation retry is an internal, idempotent operation in v1, and resubmitting with the same
`submissionId` reads the same Attempt rather than creating a second one.

### 10.3 Get Attempt

```http
GET /api/v1/attempts/:attemptId
```

Returns `200` for `evaluating`, `completed`, or `failed` attempts. The frontend polls this endpoint
only while the authoritative response remains `evaluating`.

## 11. Adaptive Interventions

### 11.1 Policy Result

After mastery is updated on a Core Node, any assessed Concept below `0.75` produces
`optional_review`; otherwise the result is `continue`. All interventions use `required = false`.
Adaptive assessments always produce `continue` and never create further interventions.

A core node gets at most one intervention per user, including retakes. The module transaction lock
serializes this check. Existing offers/content are reused; completed or skipped interventions are
not regenerated. Pre-migration duplicates remain readable but no new duplicates are added.

An offer starts in `offered`, with a snapshot of Concepts below `0.75`. No generation run is created
until the user accepts. Core availability and completion are unaffected, including on the final
Core Node. A user may continue core work while an offer, generation, or adaptive node remains open.

`AttemptResult.nextAction` always describes current core continuation (or module completion), even
for adaptive assessments. `adaptiveInterventionId: string | null` independently identifies the
open recommendation for that core node, or the current adaptive node's own intervention. It is
`null` during evaluation/failure and when no open intervention exists. It is not the latest
unrelated intervention in the module. The UI places this optional recommendation near feedback
and always retains the core action at the end of the result.

### 11.2 Decide Optional Review

```http
POST /api/v1/adaptive-interventions/:interventionId/decision
Idempotency-Key: 018f0df2-f35a-7c12-9dd2-ff7f5d3ef9b0
Content-Type: application/json

{ "decision": "accept" }
```

`accept` transitions `offered -> generating`, queues adaptive generation, and returns `202` with
`nextAction.type = wait_for_adaptive`. `decline` transitions `offered -> skipped` and returns `200`
with the Core Journey `nextAction`.

Only an `offered` intervention can transition. A repeated identical idempotent decision replays
the original result. An identical decision with a new key returns the current state without
creating another generation; a contradictory later decision returns
`409 ADAPTIVE_DECISION_ALREADY_MADE`. Accepting from the attempt result navigates to the adaptive
page after the durable command succeeds. Continuing core does not accept or decline the offer,
so it can still be opened later from that assessment result.

### 11.3 Read Adaptive Intervention

```http
GET /api/v1/adaptive-interventions/:interventionId
```

Returns:

```ts
type AdaptiveIntervention = {
  id: string;
  moduleId: string;
  status:
    | "offered"
    | "generating"
    | "available"
    | "in_progress"
    | "completed"
    | "failed"
    | "skipped";
  required: false; // compatibility field
  reasonSummary: string | null;
  triggerNodeId: string;
  resumeNodeId: string | null;
  targetConcepts: Array<{
    key: string;
    name: string;
    masteryScore: number;
  }>;
  nodes: JourneyNode[];
  generation: GenerationStatus | null;
  nextAction: NextLearningAction; // adaptive continuation while open
  coreNextAction: NextLearningAction; // independent current core continuation
  createdAt: string;
  completedAt: string | null;
};
```

`reasonSummary` is safe, concise learner-facing text. It must not reveal internal threshold values,
prompts, or model reasoning.

### 11.4 Stream Adaptive Generation

```http
GET /api/v1/adaptive-interventions/:interventionId/generation/events
Accept: text/event-stream
Authorization: Bearer <token>
```

This uses the same snapshot-first SSE protocol as module generation. On completion, the terminal
event includes `nextAction` pointing to the first available Adaptive Node.

### 11.5 Adaptive Completion

Adaptive Nodes use the same start, non-assessment completion, and Attempt endpoints under their
parent Module. When the final Adaptive Node completes, the API atomically marks the intervention
completed and awards intervention XP exactly once. It returns the current Core Journey action.
It never writes the historical Resume Node back into module progress or changes Core progress.

An accepted intervention remains available to finish later, but users can continue core work at
any time, including during generation or after generation failure. Module completion depends only
on Core Nodes. Explicit cancellation of an accepted generation is not provided.

### 11.6 Existing mandatory interventions

Migration `0010_optional_adaptive` changes existing `required` flags to false, unlocks the earliest
unfinished Core Node for affected users, and repairs missing/invalid core pointers without
replacing an available/in-progress core pointer. Existing jobs and generated content are retained.
Stop old API/worker processes before applying the migration, then start the updated version;
otherwise an old finalizer could recreate a mandatory gate. Historical Attempt policy values
remain readable and do not govern availability.

## 12. State and Authorization Matrix

| Operation | Allowed states | Otherwise |
|---|---|---|
| Use Source in generation | `ready` | `409 SOURCE_NOT_READY` |
| Retry Source | `failed` and retryable | `409 SOURCE_RETRY_NOT_ALLOWED` |
| Read generation | `generating`, `ready`, `failed` | `409 GENERATION_NOT_AVAILABLE` |
| Retry Module generation | `failed` and retryable | `409 GENERATION_RETRY_NOT_ALLOWED` |
| Archive Module | `ready`, `archived` | `409 MODULE_ARCHIVE_NOT_ALLOWED` |
| Read journey | `ready`, `archived` | `409 MODULE_NOT_READY` |
| Start/complete/attempt node | Module `ready`; node unlocked | `409 MODULE_NOT_LEARNABLE` or `NODE_LOCKED` |
| Complete non-assessment node | no assessment activities | `409 ATTEMPT_REQUIRED` |
| Submit Attempt | assessment node | `409 ACTIVITY_NOT_ASSESSABLE` |
| Decide optional review | intervention `offered` | `409 ADAPTIVE_DECISION_ALREADY_MADE` |

All rows in the matrix also require ownership. Ownership failure is always `404`.

## 13. Stable Application Error Codes

The initial public code catalogue is:

```text
AUTHENTICATION_REQUIRED
AUTHENTICATION_INVALID
AUTHORIZATION_ERROR
NOT_FOUND
VALIDATION_ERROR
IDEMPOTENCY_KEY_REQUIRED
IDEMPOTENCY_CONFLICT
SUBMISSION_CONFLICT
SOURCE_TOO_LARGE
SOURCE_UNSUPPORTED_MEDIA_TYPE
SOURCE_INVALID_PDF
SOURCE_TEXT_NOT_EXTRACTABLE
SOURCE_NOT_READY
SOURCE_PROCESSING_FAILED
SOURCE_RETRY_NOT_ALLOWED
MODULE_NOT_READY
MODULE_NOT_LEARNABLE
MODULE_ARCHIVE_NOT_ALLOWED
GENERATION_NOT_AVAILABLE
GENERATION_RETRY_NOT_ALLOWED
NODE_LOCKED
ATTEMPT_REQUIRED
ACTIVITY_NOT_ASSESSABLE
ATTEMPT_EVALUATION_FAILED
ADAPTIVE_DECISION_ALREADY_MADE
RATE_LIMITED
DEPENDENCY_UNAVAILABLE
INTERNAL_ERROR
```

Adding a new error code is non-breaking. A client must always retain a generic fallback based on
HTTP status.

## 14. Required Data-model Alignment

The current ERD and Drizzle baseline need these changes before the full contract can be implemented:

1. **Node-level Attempt aggregate** — keep `attempts` at Module Node scope and introduce
   `attempt_responses` keyed by `(attempt_id, activity_id)`. Move each activity answer and result
   there. `attempt_number` increments per user/node, matching the quiz flow that submits several
   questions together.
2. **Attempt lifecycle and deduplication** — add `submission_id`, `evaluation_status`
   (`evaluating`, `completed`, `failed`), `evaluated_at`, and a unique constraint that prevents one
   user's submission ID from creating multiple Attempts.
3. **Generating Module metadata** — allow `modules.title` to be null while status is `generating` or
   `failed`, and enforce a non-null title for `ready` and `archived`.
4. **One request, one Module** — make `modules.generation_request_id` unique if the documented
   one-to-zero-or-one relationship remains authoritative.
5. **Optional review state** — add `offered` to `adaptive_status`, plus an explicit `required`
   flag or stable reason/policy field so authorization does not depend on prose.
6. **Timezone** — add `users.timezone` with a defined default so streak calculations are
   deterministic.
7. **Idempotent commands** — add durable idempotency storage for expensive commands. Redis alone is
   insufficient for Attempt and XP correctness.
8. **Exactly-once learning rewards** — add uniqueness that prevents duplicate XP Events for the
   same user, reason, and qualifying reference.
9. **Deterministic ordering** — add unique constraints for Core Node position per Module, Adaptive
   Node position per intervention, Activity position per node, and generation-step position per run.
10. **Recoverable dispatch** — add an outbox or equivalent durable dispatch record for accepted
    source, module, evaluation, and adaptive work.
11. **Safe source failure** — persist a structured source-processing failure category and retryable
    flag instead of relying on unstructured internal metadata.

Until these alignments are applied, the API implementation must not pretend that the associated
guarantees are already enforceable.

## 15. Contract Package Boundaries

Recommended executable contract layout:

```text
packages/contracts/src/api/
├── common/
│   ├── errors.ts
│   ├── pagination.ts
│   └── identifiers.ts
├── users/
├── dashboard/
├── sources/
├── modules/
├── learning/
├── attempts/
└── adaptive/
```

Each endpoint should have exported Zod schemas for params, query, request body, success response,
and public error codes. API controllers validate inputs; the web app validates responses at the
transport boundary. Worker-only AI schemas remain separate from public HTTP contracts.

## 16. Acceptance Scenarios

The v1 API contract is sufficient when these scenarios pass at the public HTTP boundary:

1. An authenticated first request creates one local user and one stats record without duplication.
2. A learner uploads a PDF, observes processing, and can use it only after it is ready.
3. A learner combines ready PDF, URL, and text Sources with roles, priorities, selectors, and a
   separate Generation Instruction.
4. Repeating module creation with the same idempotency key produces one Module.
5. The learner disconnects from SSE, reconnects, receives a current snapshot, and eventually sees a
   ready or failed state.
6. Generation retry creates a new Generation Run without duplicating the Module's stable content.
7. A ready journey exposes the correct next node while keeping locked content inaccessible.
8. Completing a lesson twice awards XP once and advances Core progress once.
9. One quiz submission records answers for all question activities as one immutable Attempt.
10. Repeating the same `submissionId` neither duplicates mastery evidence nor XP.
11. Pre-submission activity payloads never reveal evaluation configuration.
12. A completed Attempt updates Concept Results, Mastery, progress, XP, and next action atomically.
13. Medium mastery produces an optional review that can be accepted or declined exactly once.
14. Low mastery offers optional adaptive content; only acceptance starts generation, and Core
    Nodes remain available throughout generation, failure, and adaptive learning.
15. Adaptive completion resumes the stable Core Journey without changing Core progress totals.
16. Returning later produces the same authoritative next action on the Dashboard and Journey.
17. Cross-user IDs consistently return `404` and disclose no resource data.
18. Provider, storage, queue, and validation failures return safe recoverable states without raw
    internal details.

## 17. Accepted v1 Defaults

The following defaults are accepted for the v1 contract baseline:

| Decision | Accepted v1 default |
|---|---|
| Maximum PDF size | `25 MiB` |
| Maximum sources per Module | `10` |
| Maximum pasted text | `100,000` Unicode code points |
| Maximum Generation Instruction | `4,000` Unicode code points |
| Maximum short answer | `4,000` Unicode code points |
| Idempotency retention | `24 hours` for creation/retry commands; permanent via `submissionId` for Attempts |
| Default timezone | `UTC` until explicitly configured |
| URL source support | public HTML pages only; no authenticated pages or paywall bypass |
| PDF extraction | text-layer PDFs; OCR deferred |
| Module list page size | default `20`, maximum `100` |

Source deletion/retention and explicit cancellation of accepted adaptive generation remain deferred.
Continuing core work while leaving adaptive work unfinished is supported.

## MVP account usage policy

All accounts share the same limits, with no tiers, billing, credits, or rollover:
10 Modules and 40 combined text/PDF/URL Sources per week. API environment overrides are
`USAGE_MODULES_WEEKLY_LIMIT` and `USAGE_SOURCES_WEEKLY_LIMIT`. Weeks start Monday 00:00
`Asia/Jakarta`, independently of the profile timezone. No counter table or reset cron is used.

`GET /api/v1/me/usage` requires authentication and returns:

```json
{
  "data": {
    "periodStart": "2026-09-06T17:00:00.000Z",
    "resetAt": "2026-09-13T17:00:00.000Z",
    "timezone": "Asia/Jakarta",
    "modules": { "limit": 10, "used": 3, "remaining": 7 },
    "sources": { "limit": 40, "used": 8, "remaining": 32 },
    "activeModuleId": null
  }
}
```

Usage counts owned records by `created_at` within `[periodStart, resetAt)`, including records
created before this policy shipped and all statuses. Creation consumes quota only if its
idempotency transaction commits. Validation errors, rollbacks and idempotency replays do not
consume another unit. Later processing failure and archival do not refund usage. Reusing an
existing Source, learning, answer evaluation, adaptive generation, and manual/worker retries
consume no weekly units.

A user-scoped transaction advisory lock serializes create/retry before resource locks. Checks
run after validation and before inserts/storage upload. The quota check timestamp is also the
record's creation timestamp, including uploads crossing the reset boundary. At most one
`type = module` run in `queued`/`processing` is allowed per account, across all weeks. Terminal
runs release the slot. Existing excess active runs are allowed to finish; no new run is admitted
while any is active.

Quota rejection is `429 USAGE_LIMIT_EXCEEDED`, with top-level `category` (`modules` or `sources`),
`resetAt` and a `Retry-After` header in seconds. Slot rejection is `409 GENERATION_IN_PROGRESS`
with top-level `activeModuleId`. Manual retry exhaustion is `409 RETRY_LIMIT_EXCEEDED`. Provider
failure details are preserved; `failure.retryable`, `retriesRemaining`, and the active slot jointly
determine retry eligibility. Older cached idempotency responses without `retriesRemaining` decode
conservatively as zero; a fresh resource read returns the current lifetime allowance.

Per-minute rate limiting remains independent. Redis failure does not bypass PostgreSQL usage
checks, and database failures never admit a creation. Rejections emit `usage.rejected` structured
logs with user/request IDs, code, and applicable quota/active-module context.

Deploy migration `0011_lyrical_moondragon.sql` before the API and web bundles. See
[usage rollout verification](release/usage-mvp.md) for evidence and remaining runtime checks.

## Global leaderboard

`GET /api/v1/leaderboard` requires authentication. Returns the standard `{ data }`
envelope. Participant identities contain only local `userId` and `displayName`;
blank names become `Pelajar`. No email or Clerk identity is returned.

```json
{
  "data": {
    "serverTime": "2026-09-09T00:00:00.000Z",
    "inactivityDays": 7,
    "nextExpiresAt": "2026-09-16T00:00:00.000Z",
    "participants": [
      { "userId": "00000000-0000-4000-8000-000000000001", "displayName": "Pelajar", "score": 500, "rank": 1 }
    ],
    "self": {
      "userId": "00000000-0000-4000-8000-000000000001",
      "score": 500,
      "rank": 1,
      "expiresAt": "2026-09-16T00:00:00.000Z"
    }
  }
}
```

At launch, existing lifetime XP seeds active leaderboard XP once. Each successfully
inserted XP event adds to an unexpired score (or starts a new score after expiry)
and sets expiry to database award time plus 168 hours. Retries and reading content
do not extend it. The effective score is zero at or after expiry. Lifetime XP and
learning progress remain unchanged by reset.

Only positive, unexpired scores are ranked. Equal scores share competition rank
(1, 1, 3); user ID orders ties. `participants` contains at most 50 users, while
`self` always describes the caller, including ranks outside the top 50. An unranked
caller has score 0 and rank null. `self.expiresAt` retains a past expiry to distinguish
a reset score from a new user (null). `nextExpiresAt` is the earliest active expiry
across all participants, including those outside the top 50, or null. Clients use
it with `serverTime` to schedule refreshes. All values use one database snapshot.
