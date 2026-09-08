# Global leaderboard rollout

Implementation includes the authenticated endpoint, Zod response contract, global
ranking, shared transactional XP helper, `/leaderboard`, desktop/mobile navigation,
and refresh on XP completion, focus/visibility return, visible 60-second polling,
and the earliest active expiry. No unit or integration test suite was added.

## Launch sequence

1. Prepare and build the new API, worker and web version before the maintenance window.
2. Stop old API and worker processes that can award XP, and wait for their in-flight
   transactions to finish. Keep them stopped until the new binaries are ready.
3. Run `bun run db:migrate` from the repository root with the target `DATABASE_URL`.
   Migration `0014_lazy_warstar.sql` must run through the transactional Drizzle
   migrator. Do not execute its individual statements with autocommit.
4. The migration takes ACCESS EXCLUSIVE on `user_stats` before adding columns and
   copying total XP. It captures a single database launch time after the lock and
   gives every positive score exactly 168 hours. Zero XP retains null expiry.
5. Start only the new API/worker version, then publish the web build. Verify the
   authenticated endpoint and an XP-awarding activity. Do not roll back to old XP
   writers after migration: they cannot update leaderboard scores.

The migration was rehearsed inside a rolled-back local PostgreSQL transaction,
then applied persistently to the local development database after a schema mismatch
caused authenticated requests to fail. No production deployment was performed.
The seven-day launch clock uses the database timestamp captured during the actual
migration, after acquiring the lock.

## Verification evidence

- PASS: `bun run db:check`, workspace-wide `bun run typecheck`, `bun run build`.
- PASS: Biome check/format on all touched TypeScript/TSX files and `git diff --check`.
- Global `bun run lint` is blocked by two existing `noSvgWithoutTitle` errors in
  `apps/web/public/favicon.svg`; unrelated warnings also remain.
- PASS, rollback-only PostgreSQL rehearsal: new columns/backfill; scores equal
  lifetime XP; shared positive expiry; zero-XP null expiry; unchanged lifetime XP
  sum and XP event count.
- PASS, actual core finalizer inside rollback: first completion awards 10 XP;
  completed retry and XP-event conflict preserve both score and expiry.
- PASS, actual leaderboard service with 55 rollback fixtures: top 50, caller rank
  55, 1/1/3 ties, stable ID tie order, blank-name fallback, expired-score exclusion.
- PASS, actual helper: active score adds XP, deadline reached resets score to the
  new award, expiry extends 168 hours, lifetime XP is unchanged by the helper.
- PASS, two concurrent rollback transactions in an isolated scratch schema:
  statistics lock serializes awards; a transaction started before expiry but
  acquiring its lock after expiry resets to its new XP using database wall time.
  Scratch schema removed afterward. This does not certify two committed full
  activity completions or provider-driven adaptive completion.
- NOT RUN: full adaptive completion/retry runtime, authenticated HTTP/Clerk flow,
  desktop/mobile visual and keyboard checks, browser refresh/timer/error scenarios.
  Browser setup failed before navigation: tool sandbox metadata missing
  `sandboxPolicy`. Static UI inspection and production build are not browser evidence.

Temporary verification scripts were removed after execution; the rollback rehearsals
retained no learner data, synthetic users, migration state, or scratch schema. The
subsequent local migration described below remains applied.

## Local schema mismatch recovery

The updated auth guard inserts `user_stats` on every authenticated request. Drizzle
includes the newly declared columns even with `onConflictDoNothing`, so running
the new schema against an unmigrated database raised PostgreSQL 42703 (missing
`leaderboard_xp`) before dashboard/usage handlers could run.

Applied migration 0014 through the transactional Drizzle migrator against the
API-configured localhost database. Both running API/worker processes were started
after the new XP helper was implemented. Verified zero backfill mismatches, one
shared expiry, unchanged lifetime XP/event counts, and the original auth statistics
insert passing inside a rolled-back transaction. `/health/ready` returned OK for
PostgreSQL, Redis and storage. Authenticated browser HTTP remains NOT RUN.

## Cleanup review

The React page composes separate personal-score and ranking components. Status copy
uses explicit branches, and conditional row styling uses the shared `cn` helper.
All feature styling uses Tailwind utilities and semantic theme tokens; no custom
CSS is needed.

This review reran workspace typechecking, production builds, migration metadata
checks, touched-source Biome checks, and whitespace checks. Global lint still has
the existing favicon errors described above. Database runtime rehearsals and
browser/authenticated flows were not rerun during cleanup; earlier runtime evidence
above is retained as historical verification.
