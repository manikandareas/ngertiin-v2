# Dashboard, sidebar, and composer verification — 2026-09-06

## Review and cleanup

- DashboardContent owns page layout; DashboardSummary owns summary cards; DashboardModules owns search; DashboardModuleRow owns difficulty and status presentation.
- AppSidebar owns navigation/account layout; SidebarModules owns recent-module grouping and loading/error/empty states.
- ComposerPanel owns source/focus controls. Composer retains submission and the text input, while useComposer owns validation, selection, request locking, and idempotency. Panel names use a finite union.
- Overview links share moduleOverviewRoute: ready/archived modules open their journey, generating/failed modules open their status page. Continue-learning actions still take precedence.
- The composer stays mounted but hidden when returning from creation to Beranda, preserving the draft and request identity when reopened. User changes still reset the connected composer.
- Removed unused old dashboard cards and replaced the old creation page with the existing /modules/new redirect to /dashboard#module-composer.
- Preserved the chosen sidebar, inline colorful badges, muted dark palette, and reduced-motion-aware wave.

## Checks passed

- `bun run typecheck`: all workspaces.
- `bun run build`: all workspaces.
- `bunx biome lint apps/web/src apps/api apps/worker packages`.
- `bunx biome format apps/web/src apps/api apps/worker packages`.
- `git diff --check`.
- Local preview: creation link focuses the composer; returning to Beranda hides it; reopening retains the text draft and restores focus.
- Local preview: focus panel opens/closes; submitting text invokes the local creation callback without API traffic.
- Local preview: searching for `iklim` leaves one matching module row.

## Earlier visual checks in this redesign session

Desktop/mobile layouts, light/dark themes, collapse/expand, empty state, inline badge wrapping, and reduced-motion emulation were checked using the isolated dashboard preview. Wave animation computes to `none` under reduced motion. Source controls were exercised with synthetic local callbacks; these checks do not certify provider processing.

## Limitations

- Root `bun run lint` fails on the pre-existing, untracked `apps/web/new-module-prototype.html` (including missing button types and ARIA diagnostics). The prototype is preserved and excluded from this commit; production source checks above pass.
- Authenticated Clerk/API flows, real source pagination, provider uploads/OCR/scraping, database changes, and live mutation failure/race scenarios were NOT RUN.
- Request locks, idempotency reuse, primary-role promotion, ordered priorities, Unicode/source/file limits, and identity/unmount guards were reviewed statically. No unit or integration tests were added.
