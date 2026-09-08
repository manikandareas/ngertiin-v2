# Lesson Markdown and Commons rollout

New core and adaptive lessons use Markdown and schema version 2. Legacy lessons remain readable; no migration, backfill, or content rewrite is needed. Other activity types remain version 1.

## Deployment order

1. Deploy contracts, API, and web readers supporting both formats. Keep the existing worker running until all readers are updated.
2. Verify a legacy node and a v2 lesson on the deployed reader, including signed image access from the browser.
3. Deploy the new worker. It generates only Markdown lessons. Core LangGraph checkpoints accept both formats; adaptive generation now saves its plan and completed enriched nodes in generation-step metadata and resumes those nodes on retry. Older adaptive runs without saved outputs retain their previous regeneration behavior.
4. Roll back workers first if needed. Keep the dual-format readers while any v2 content exists.

`AI_IMAGE_INPUT_ENABLED` defaults to `true`. Set it to `false` for a text-only model; image enrichment then logs `image_input_disabled` and removes image references. A failed visual provider call also falls back to text. `WIKIMEDIA_USER_AGENT` defaults to `NgertiinLessonImages/1.0 (https://ngerti.in)`; configure an appropriate deployment contact. `S3_ENDPOINT` used by the API must be browser reachable: signed URLs use that endpoint and expire after 900 seconds.

## Image handling

Only Commons files with public domain/CC0, CC BY, or CC BY-SA metadata and a creator are eligible. Store license name, version, link, file title, source page, creator, dimensions, caption, and alt. SVG originals may provide PNG thumbnails; stored bytes are raster JPEG/PNG/WebP, unchanged from the reviewed thumbnail. No cropping or content edits occur.

Each lesson permits two visual needs, five search candidates per need, and at most three raster thumbnails sent to the configured model. HTTPS host allowlists cover the Commons API and upload/thumbnail hosts, including redirect hops. MIME, magic bytes, and a 5 MB streaming download ceiling are checked. API metadata is also bounded. A 60-second abort signal spans search, inspection, and S3 writes. Wikimedia rate-limit/maxlag responses abandon enrichment and defer further requests in the process, respecting Retry-After with a minimum 60-second cooldown.

Only selected thumbnails are stored. Keys derive from run/node/activity/slot; retry overwrites that slot rather than creating new keys. Completed enriched checkpoint outputs are reused. Logs include duration, eligible candidates, selections, model review reasons, and skip/failure stage. Missing references are removed. Public responses exclude the objectKey field and assessment evaluationConfig.

Streamdown renders static Markdown with code and math plugins, existing fonts/tokens, bounded horizontal scrolling, and registered images only. A remark transform drops raw HTML. Image errors share one detail fetch per mounted lesson; persistent failures hide the image and credit block without blocking reading.

## Verification on 2026-09-08

- Static checks: all workspace typechecks and builds passed; lint, format check, and git diff check passed. Lint reports existing prototype warnings. Streamdown/math are loaded only for Markdown lessons; the build still reports large optional highlighting/Markdown chunks.

- Live configured provider: four manual calls produced small lessons, quizzes, and flashcards for binary search, osmosis, English logical implication, and an Indonesian adaptive-style implication review. These exercised the shared activity schema/style and enrichment service directly, not the full job pipeline. Outputs were inspected for language and concept accuracy; code and truth tables were present. Initial math used backslash delimiters; the final prompt explicitly requires dollar delimiters and inline math is enabled in the renderer.
- Live Commons/vision/S3: chloroplast query returned five eligible candidates; three thumbnails were inspected, one selected and stored. A signed URL returned HTTP 200 with image/png. Desktop/mobile browser rendered the selected diagram and attribution.
- Live failure exercises: empty search returned text only; chloroplast candidates were rejected for a binary-search lesson; an unreachable S3 endpoint produced `storage_failed` and text-only content. No failed visual references remained.
- Manual schema checks: legacy checkpoint accepted, new generation rejects legacy output, all four new samples accepted as checkpoints, and public assessment parsing stripped evaluationConfig.
- Browser CLI fixture used production Lesson components with generated content at 1280 px and 390 px. Legacy/new content, code, tables, ten inline/display formulas, attribution, and signed images rendered. Long code scrolled horizontally; document width stayed within viewport. Raw HTML and unregistered images were removed. Failed images hid while lesson text remained. The image refresh could not reach the authenticated detail endpoint because the browser was signed out.
- In-app browser connection failed during bootstrap with `missing field sandboxPolicy`; browser CLI was used successfully. Temporary fixture and manual scripts are removed after verification.

Review cleanup separates image retry/attribution into `LessonImage`, shares image types through the contracts package, and keeps adaptive checkpoint shape validation in `adaptive.schemas.ts`. The Commons smoke check was repeated after cleanup: five eligible candidates (CC0, CC BY 3.0, CC BY-SA 4.0) and a 221,609-byte raster download. Browser and provider generation checks above were not repeated during cleanup.

For local verification, avoid two Vite processes sharing `node_modules/.vite`. A second process rebuilding that cache caused an `Outdated Optimize Dep` 504 during this change. Restarting the primary dev server with `--force` restored current dependency/chunk requests to HTTP 200; existing tabs need a hard refresh.

Full authenticated navigation/completion, a real adaptive queue job, persisted retry/finalization of old/new checkpoints, refreshed expired signed URLs through the authenticated API, provider timeout/rate-limit injection, and deployment checks are **NOT RUN**. These remain rollout acceptance checks. No unit or integration tests were added.

References: [Streamdown usage](https://streamdown.ai/docs/usage), [Imageinfo](https://www.mediawiki.org/wiki/API:Imageinfo), [Commons reuse](https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia), [API etiquette](https://www.mediawiki.org/wiki/API:Etiquette).
