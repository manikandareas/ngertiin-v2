# Materi saya verification — 2026-09-08

Implemented `/sources`, shared source-add forms/menu/idempotency state, stored-content preview,
five-minute signed PDF URLs, rename, archive/restore, and active-only new generation validation.
Migration `0013_wise_blazing_skull.sql` adds nullable `sources.archived_at` and was applied to the
local `localhost/ngertiin` database. No unit or integration test files were added.

## Passed

- Full workspace typecheck and build.
- Targeted Biome checks for changed TypeScript/TSX, Drizzle migration consistency, and
  `git diff --check`.
- Manual service checks against local PostgreSQL inside a rolled-back transaction: text creation
  and paragraph-preserving preview, literal search containing `%`, cursor pagination, 200/201
  Unicode code-point title boundaries, archive listing/default active listing, rename while
  archived, restore, and unchanged source quota usage.
- Owner checks for detail, preview, rename/archive, and file reject another account with `NOT_FOUND`.
  This exercised service ownership predicates, not authenticated HTTP requests.
- A generation accepted before archival could still load its source through the worker source
  reader. A new generation using the archived source was rejected.
- PDF extraction sections followed stored page position. An archived failed PDF could not retry;
  restoring it allowed a pending processing run.
- A freshly signed PDF URL could be fetched from local MinIO. The temporary storage object was
  deleted after the check; all database fixtures were rolled back.
- Browser navigation to `/sources` redirected to Clerk sign-in without a browser error.

## NOT RUN

The browser session had no authenticated account. The following still need authenticated manual
verification:

- Add PDF/URL/text from both the collection and builder, including quota and idempotent retry UI.
- Rename, search/filter/pagination, original PDF and stored-text preview, archive/restore, and cache
  refresh in the collection and builder; draft selections that become archived.
- Keyboard navigation, dialog focus restoration, context menus, and mobile layout.
- Cross-account HTTP access with two real Clerk sessions.
- Concurrent archive versus processing/generation requests and completion of an in-flight worker.
- Full retry of an old module and provider-backed generation/extraction.
- Storage outage/missing-object UI and signed URL expiry/reload after five minutes.

Local service and storage checks do not certify authenticated browser or provider flows.

## Review and cleanup

- Extracted source rows, filters, action dialog, and the PDF/text preview components. Preview data
  is loaded by the visible tab. Shared source forms no longer own builder settings.
- Consolidated modal layout, busy dismissal guards, and focus restoration in `DialogFrame`.
  Action submission has an immediate lock against duplicate requests.
- Replaced custom menu utilities and the dialog keyframe with shared Tailwind classes and the
  existing animation utilities. Remaining custom styles stay in the app root `index.css`.
- Removed forwarding-only builder files, consolidated source metadata formatting and database
  source projections, and made PATCH return the updated row directly.
- Re-ran all workspace typechecks/builds, full formatting, targeted lint, migration consistency,
  diff checks, and the rolled-back PostgreSQL/MinIO manual checks after cleanup: passed.
- Full-repository lint reports two existing `noSvgWithoutTitle` errors in the unchanged
  `apps/web/public/favicon.svg`, plus existing prototype warnings. Those files are outside this
  change. Authenticated browser/provider checks listed above remain `NOT RUN`.
