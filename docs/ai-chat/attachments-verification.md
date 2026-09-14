# Chat attachments — 2026-09-13

Implemented for standalone and module chat using the existing composer, durable admission, Responses API model, executor, history and cancellation paths. Attachments are private conversation data, not Sources or modules.

## Contract and operations

- `POST /api/v1/chat/attachments`: multipart `file`; authenticated owner; JPEG, PNG, WebP, PDF, DOCX, PPTX, XLSX, UTF-8 TXT/Markdown/CSV. Images are decoded, PDFs parsed, Office archives bounded and their XML/structure checked.
- `GET /api/v1/chat/attachments/:id`: owner metadata. `GET /:id/download`: owner-checked URL valid for 60 seconds, `no-store`. `DELETE /:id`: draft only, immediately inaccessible; storage cleanup retries independently of the chat scheduler.
- `attachmentIds` is optional on text requests. A message needs text or attachments, with distinct IDs, at most five files, 10 MiB each and 25 MiB combined. IDs enter the existing idempotency fingerprint. Ownership, draft expiry, total bytes, context allowance, and message binding are checked under the admission transaction's locks.
- Migration `0021_pale_morbius.sql` was generated, checked, and applied locally before runtime verification. Deployments must run migrations before the new API.
- API accepts `MISTRAL_API_KEY` and `MISTRAL_OCR_MODEL`; production Compose forwards both. The existing worker credentials were copied to missing keys in the ignored local API environment without printing their values. The worker still delegates PDF extraction and retains its error classification and default SDK behavior.
- Unused drafts expire after 24 hours. Cleanup runs at startup and every minute, with bounded object-deletion attempts. Deleted threads immediately fail download authorization; previously issued storage URLs expire within 60 seconds. Objects and extraction data are collected on subsequent cleanup, retrying storage failures.

## Model behavior

Native bytes are assembled only for the provider invocation using the installed LangChain adapter's image/file input blocks. Message storage contains attachment metadata/IDs, not base64 or signed URLs. Successful OCR is cached on the attachment and reused across retries and follow-up messages.

Fallback requires an allowlisted structured unsupported-format/modality/readability code with HTTP 400/415/422 and is permitted only on the first model call before any streaming callback or tool execution. It runs at most once. Both token and Responses stream callbacks are configured in the model constructor so LangChain model clones retain this guard. Timeout, authentication, rate limiting, invalid/corrupt input, and context overflow do not select OCR. Mistral handles supported images/PDF/DOCX/PPTX; text files use a strict UTF-8 fallback; rejected XLSX fails explicitly. Extraction prompts state that visual details unavailable in the extracted text cannot be inferred.

Context counting strips binary blocks from tokenizer input and reserves file estimates from validation. Total file history is bounded to 25 MiB, old user/assistant pairs are removed together, and the current message must fit. OCR-expanded history is trimmed again before the retry. Estimates are conservative rather than provider token guarantees; an actual provider context overflow remains a distinct error. OCR usage and its run ID are stored separately from OpenAI token usage; in-flight OCR is marked with unavailable coverage, and completion/failure/cache writes use the run lease, epoch, cancellation, and deadline fence.

Provider references: [OpenAI file inputs](https://developers.openai.com/api/docs/guides/file-inputs), [Mistral OCR](https://docs.mistral.ai/studio/document-processing/basic_ocr). Office cards explain embedded-image and spreadsheet-reading limitations.

## Verified

No unit or integration test suite was added. Temporary executable fixtures were used and moved outside the repository after verification.

- All workspace typechecks and builds passed. Touched-code Biome checks and `git diff --check` passed. `bun db:check` passed; migration applied locally. Web build retains its chunk-size warning.
- Fixture validation accepted all ten supported formats; rejected false image/PDF/Office content, invalid UTF-8/binary text, mismatched MIME, legacy Office, oversized files, duplicate IDs and more than five IDs.
- Real PostgreSQL/S3/Redis service fixtures verified private object upload/download, signed URL TTL, foreign-owner denial, expired draft denial/cleanup, draft removal, atomic attachment-only admission, durable history metadata, stable idempotent replay, changed-payload conflict, retry with existing attachments, queued cancellation, thread deletion and object cleanup.
- Real model native PDF input returned `BIRU-42`. Real Mistral OCR extracted the same fixture text.
- Real durable executor completed attachment-only native PDF and follow-up runs with complete model usage and no OCR. Replaying the original idempotency key returned the original acknowledgment. Stored history contained no base64.
- A structured native format rejection was injected at the provider boundary; the real executor called real Mistral once, retried the same configured chat model successfully, and completed a follow-up from the persisted extraction cache. Both runs had complete model token usage; OCR separately recorded one processed page.
- Provider-boundary fixtures verified no fallback for 429, timeout, corrupt-file code, unstructured error prose, or an already-started response; one fallback for the allowlisted format rejection. An uncooperative OCR promise was abandoned after abort grace and its late completion was rejected. A terminal run could not save an extraction.
- Multimodal fixtures verified that 10 MiB of base64 did not enter text token counting, combined file history stopped at 25 MiB, and cached extraction avoided binary loading.
- Authenticated Brave UI: selected PNG and PDF, previewed the image draft, sent both without text, and received a completed answer recognizing `BIRU-42` and asking how to help. Reload preserved both attachment cards and the answer. A browser follow-up returned `BIRU-42`. Pasting a clipboard PNG uploaded and previewed `image.png`; removing it cleared the draft and disabled attachment-only sending. The local fixture conversation is retained at `/chat/a3182cba-c30c-4347-98f0-75794a6d5944` for review.

## Acceptance still to run

Full release acceptance remains incomplete: the complete format matrix through authenticated multipart/browser UI; drag-and-drop; upload-failure UI retry; mobile interaction; attachment chat with module mentions; storage-outage cleanup retry; exact 25 MiB boundary through HTTP; deliberate SSE disconnection and process restart while processing attachments; and cancellation during an actual remote OCR request. Existing chat fault evidence is not counted as newly rerun attachment acceptance.

The in-app browser tool failed with `missing field sandboxPolicy`, so browser checks used Computer Use with the authenticated local Brave session. A transient React Fast Refresh hook-order error while editing was cleared by a full reload; the final rendered history and follow-up were then checked.

## Cleanup verification — 2026-09-14

- Moved the run error class into `chat.errors.ts` to remove the agent/multimodal runtime import cycle. Kept the existing error codes and execution behavior.
- Extracted Office validation and attachment UI handlers, replaced nested terminal-message conditions, and named lifecycle limits. File-extension allowlists now use own-property checks so prototype names are rejected with validation errors.
- Reran workspace typechecks/builds, scoped Biome, migration consistency, and diff checks after cleanup. Reused disposable fixtures for all supported formats and malformed files, prototype-name extensions, native/fallback/error/partial-stream branches, multimodal context limits/cache reuse, and late OCR cancellation; all passed. No test suite was added.
- Authenticated browser and real provider/OCR checks above are evidence from 2026-09-13; they were not rerun for this cleanup. The remaining acceptance scenarios still apply.
