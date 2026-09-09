# Settings verification — 2026-09-09

Implemented `/settings?tab=account|appearance|learning|usage`; `/profile` redirects to the account
tab. The old profile page/form are replaced. Account actions use Clerk SDK resources; learning
profiles, uploaded avatars, and generation defaults use the Ngerti.in API/database/storage.

## Automated checks

| Check | Result | Scope |
| --- | --- | --- |
| `bun install --frozen-lockfile` | PASS | Lockfile includes pinned API dependency `sharp@0.35.4`. |
| `bun run typecheck` | PASS | All workspaces. |
| `bun run build` | PASS | All workspaces; existing Vite large-chunk warning remains. |
| `bun run db:check` | PASS | Migration lineage, including 0016. |
| `bun run db:migrate` | PASS | Applied to local PostgreSQL on localhost, database `ngertiin`. |
| `bun x biome check` on all 40 changed/new TS, TSX, and JSON files | PASS | No diagnostics in changed implementation files. |
| `git diff --check` | PASS | No whitespace errors. |
| `bun run lint` | FAIL — pre-existing | Five errors: two SVG-title errors in `apps/web/public/favicon.svg`, three unsupported ARIA labels in `docs/prototype/leaderboard-variations.html`. Neither file was changed. Existing warnings/information also remain. |
| `bun run format:check` | FAIL — pre-existing | `packages/database/migrations/meta/0014_snapshot.json` and `0015_snapshot.json` do not match Biome formatting. Neither was changed. New snapshot 0016 and the updated journal pass. |

## Local database and storage checks

Ran temporary, direct service smoke checks against real local PostgreSQL and MinIO. Created an
isolated user/stats row, exercised the services, and removed the row and all created objects.
The temporary script was removed; no unit or integration test suite was added.

Verified:

- New-user generation defaults and saved language, length, canonical activity order, timezone,
  and display name.
- Valid JPG, PNG, and WebP inputs normalize to WebP. The 800 x 600 fixture becomes 512 x 512;
  image metadata is stripped.
- A signed avatar URL returns HTTP 200 and `image/webp` from MinIO.
- Current profile and leaderboard resolve the same stored avatar. Internal object-key fields
  are absent from public payloads.
- Missing files, unsupported MIME types, invalid bytes, truncated PNGs, oversized uploads,
  and images above the decoded pixel limit are rejected.
- Simulated storage write failure and simulated database transaction failure retain the previous
  avatar; a newly uploaded object is cleaned up on failed database writes.
- Replacement and reset delete superseded objects. Concurrent replacements leave the winning
  object available and delete superseded objects.

These checks call the real services directly. They do **not** certify authenticated HTTP routing,
Clerk guards, multipart interception, or deployment configuration.

## Browser checks

The actual application at localhost:5173 redirected the browser to the existing Clerk sign-in
page, showing Google and GitHub. An authenticated testing session was not available.
The in-app browser tool failed with a sandbox metadata error; browser checks used agent-browser.

A temporary Vite harness rendered the production settings components and builder, using simulated
Clerk resources and API responses. The harness and its server were removed after verification.

Verified in this harness:

- Desktop sidebar collapsed/expanded; mobile header and portalled navigation sheet.
- Light/dark theme cards, radio keyboard interaction, persistence across reload, and mobile
  appearance layout. At 390 px, document/main width remained 390 px with no page overflow.
- Horizontal scrolling tabs on mobile. Arrow keys move focus; Enter activates a tab.
- Unsaved-name navigation warning, staying on the form, discarding a draft, and saving the name.
  Saving updates the sidebar identity. Fixed tab focus restoration reopening the leave dialog.
- Learning preferences initialize from the profile. Empty activity selection disables saving;
  drafts survive profile refetch; cancellation restores persisted values.
- Usage counts and reset time displayed in Asia/Makassar, while the API reset instant remains
  unchanged.
- A verified last Google connection cannot be disconnected. A simulated reverification request
  without supported factors shows the explanation dialog and cannot complete the action.
- A new builder initializes from saved English/long/flashcard preferences. Manually changing the
  language to Indonesian survives profile refetch. Failed profile loading offers retry and an
  explicit application-default option; choosing the latter opens the builder.

## NOT RUN

- Real Clerk email addition/verification/primary-email changes/deletion.
- Real Google/GitHub linking, provider cancellation callbacks, or unlinking.
- Real device-session revocation, logout while a form is dirty, and account switching.
- Real reverification with supported credentials or Clerk's rejection for unavailable factors.
  The unsupported-factor dialog was exercised with simulated SDK data only.
- Authenticated multipart avatar HTTP requests and browser file-picker upload/reset flows.
- Native browser reload/close warnings for unsaved forms.
- Live generation/provider requests, retry/resume flows, and legacy module playback. Their
  persisted settings paths were left unchanged; only a fresh builder receives user defaults.
- Production database migration, production storage, or deployment.

## Operational notes

Apply migration 0016 before serving the updated API. No module generation settings are backfilled.
Avatar URLs are resolved on reads with one-hour signatures, and the profile refreshes periodically.
Cleanup checks database references before deleting an object. After three cleanup failures, the
key is logged for operator review; there is no background orphan sweeper. Review references before
manual deletion, especially after an ambiguous database commit response.

Reverification uses supported factors returned by Clerk, with a custom shadcn dialog and no Backend
API bypass. Login methods and the prebuilt sign-in/sign-up components remain unchanged. References:
[Clerk reverification caveats](https://clerk.com/docs/guides/secure/reverification#caveats),
[custom reverification UI](https://clerk.com/docs/react/reference/hooks/use-reverification), and
[managing SSO connections](https://clerk.com/docs/guides/development/custom-flows/account-updates/manage-sso-connections).

## Cleanup follow-up — 2026-09-09

Reviewed the complete pending settings change and extracted avatar image validation/normalization
from storage lifecycle handling. Consolidated the login-connection predicate, simplified theme
and verification-factor selection, and made learning form submission enforce the same validation
as the save button. Added explicit avatar endpoint response types.

Current checks: frozen-lockfile install, all-workspace typecheck/build, migration lineage check,
repository lint (warnings remain), formatting, and whitespace checks pass. Fixed the existing
favicon SVG titles and prototype podium semantics, and formatted snapshots 0014/0015 without
changing their JSON data. The earlier lint/format failures above describe the pre-cleanup state.

A direct local smoke check of the extracted image function confirms PNG normalization to 512 x 512
WebP and rejection of missing/invalid uploads. No test suite was added. Database/storage integration,
authenticated browser, Clerk, and provider checks were not rerun during this cleanup; earlier
verification above remains historical evidence rather than a new runtime result.
