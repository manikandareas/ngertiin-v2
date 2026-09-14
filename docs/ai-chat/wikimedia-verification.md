# Wikimedia chat images — 2026-09-14

The chat agent can proactively search for a useful illustration, including for a request such as “jelaskan proses fotosintesis” without an explicit image request. Brief/text-only requests and simple arithmetic should not trigger image search. Standalone and module conversations use the same tool.

## Implementation

- Worker and API share the existing Commons search, license/attribution filtering and bounded raster download functions in `@ngertiin/shared/commons-images`.
- One image tool invocation per run; at most two distinct English searches, three inspected images per search and one selected image. The fallback preserves the teaching purpose and runs after visual rejection as well as empty results. Search/review/storage share a 30-second timeout and the run cancellation signal.
- Review compares actual image bytes against the original user message and the agent's teaching purpose. Process explanations require visible stages, arrows or input/output relationships. A related object photo is insufficient. English diagram labels are acceptable for Indonesian explanations; captions and alt text follow the user's language.
- Visual reviews count toward the existing model-call and token budgets, reserving a step and output for the answer. Review output is excluded from the user-facing stream. Failed or rejected enrichment leaves a text answer.
- Selected image metadata is persisted as `data-image` in the existing message JSON before the agent receives its ID. Storage keys and signed URLs are not persisted in public message parts. No database migration is required.
- Markdown renders only registered `chat-image-ID` references with the existing image/attribution component. An authenticated, owner-checked message image endpoint issues a fresh storage URL. Reload reads the same durable image metadata.
- `chat.images` logs search counts, inspected counts, selected filenames, review reasons, stage, duration and error type. `chat.run_finished` includes `imageStatus` and `imageCount`; `not_requested` distinguishes no tool call from `NO_MATCH` and `UNAVAILABLE`. Original user messages and image bytes are not included in these diagnostics.

## Reported defects and fixes

1. `data-image` was missing from the Redis Pub/Sub frame validator. A local reproduction returned `ZodError` at `frames[2].type`, even though the database had saved the image. The validator now accepts the image frame on both publish and subscription paths.
2. A leaf photo passed the original relevance check for a photosynthesis process request. The reviewer now receives the original user text and checks the visual relationships required by that request, rather than accepting a merely related object.
3. Visual rejection stopped enrichment even when a fallback query existed. Rejection now advances to the second search within the existing deadline and remaining model budget. The prompt also explicitly directs proactive diagram search for visual process explanations.

## Verification

Disposable local harnesses exercised the actual configured chat model, Commons, S3/MinIO, Redis Pub/Sub and SSE framing. They used in-memory snapshots, not authenticated HTTP or the database executor. Harness files and their newly generated storage objects were removed afterward.

| Prompt | Result | Duration |
| --- | --- | --- |
| `provide a picture of the process of photosynthesis` | One tool call; `File:Photosynthesis en.svg`; image reference in answer | 10.4 s |
| `berikan gambar dari proses fotosintesis` | One tool call; same diagram; Indonesian explanation | 8.0 s |
| `jelaskan proses fotosintesis` | Proactive tool call; same diagram included in explanation | 8.9 s |
| `Jelaskan fotosintesis dalam satu kalimat tanpa gambar.` | No tool call; one-sentence text | 1.3 s |
| `Berapa 12 × 8?` | No tool call; `96` | 0.9 s |

Every stream delivered `finish` and `[DONE]`, with exactly one image frame per selected image and matching answer text. Review JSON did not leak into the answer. Generated image URLs returned HTTP 200. These are observed runs, not a guarantee of identical model choices or latency on every request.

The actual leaf photo from the reported Indonesian run was rechecked with the live model: rejected with `index: null` and `matchesPurpose: false` because it lacked a process diagram, stages, arrows or inputs/outputs.

Disposable deterministic fixtures exercised the actual tool orchestration: first candidate rejection followed by successful fallback; both searches rejected with no storage write; repeated invocation blocked; cancellation propagated without storing an image.

API/web typechecks and builds, scoped Biome checks and `git diff --check` passed. The web build still reports warnings for the existing `::highlight` CSS and large chunks; these do not fail the build. No unit or integration test suite was added. Authenticated browser streaming/reload, production proxy behavior and deployment were not rerun for this fix.


## Cleanup verification

The Commons implementation was moved unchanged into the shared package. The image/attribution renderer now lives in `apps/web/src/components/wikimedia-image.tsx`, shared by chat and lessons. Image metadata is copied before snapshot transactions so concurrent tool completion cannot mutate an in-flight snapshot.

Post-cleanup workspace typechecks/builds, scoped Biome, diff checks, and a real Redis image-frame round trip passed. The earlier live model/Wikimedia and rejection results above were not rerun during cleanup; authenticated browser acceptance remains unverified for this change.
