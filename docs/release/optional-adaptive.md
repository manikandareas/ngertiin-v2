# Optional adaptive interventions

All assessment-triggered reinforcement is optional. Core progress and module completion depend
only on core nodes. Assessment results expose core continuation in `nextAction` and an independent
nullable `adaptiveInterventionId`. The latter is scoped to the assessment's core node, or the
adaptive node's own intervention. The contextual recommendation appears between feedback and
answer review. Accepting it starts generation and opens the adaptive page.

A module transaction lock serializes assessment finalization. A core node gets at most one offer,
including retakes, and adaptive attempts never generate further offers. Repeating an acceptance
with the same or a new idempotency key does not create another generation run. Accepted work can
remain unfinished while the learner progresses through core nodes. Completion of old adaptive work
never writes a historical resume pointer back into core progress.

## Apply to an existing installation

1. Stop the previous API and worker version so it cannot create more mandatory interventions.
2. Apply database migrations with `bun run db:migrate` from the repository root, using the target
   installation's database configuration.
3. Start the updated API, worker and web together. The web requires the updated response fields.

`0010_optional_adaptive.sql` converts existing mandatory interventions to optional, unlocks the
first unfinished core node for affected learners, and restores missing/invalid core pointers.
It preserves valid available/in-progress core pointers, existing content, generation jobs, scores,
XP and completion timestamps. Existing duplicate interventions are retained, not deleted.

The migration was applied to the local `localhost:5432/ngertiin` database on 2026-09-07.
Three legacy mandatory interventions became optional; all affected earliest unfinished core nodes
are available. Node, generation-run and XP-event counts remained unchanged (94 / 11 / 6).
The existing index definitions from migration 0009 were verified against the checkout before
reconciling its previously different migration-history hash/timestamp. A local before-state was
saved to `/tmp/ngertiin-optional-migration-before.json`.

The updated API, worker and Vite development server were started. API `/health/ready` reports
PostgreSQL, Redis and storage up; the worker reports `worker.ready`; web returns HTTP 200 at
`http://127.0.0.1:5173`.

## Validation evidence

- Full `bun run release:check` after review/component cleanup: PASS.
- Workspace typecheck and build: PASS.
- Production TypeScript lint and repository format check: PASS.
- Repository lint: PASS with existing prototype warnings/informational diagnostics.
- Drizzle migration metadata check and `git diff --check`: PASS.
- Browser inspection of actual React components with temporary mocked hooks: desktop dark and
  mobile light layouts render; contextual offer and independent core links are present; acceptance
  opens the adaptive generation page. Mobile summary has no horizontal overflow. The preview was
  removed after inspection.
- Database migration execution and service readiness checks: PASS.
- Authenticated assessment/acceptance flow and live generation-provider validation: NOT RUN.
- No unit or integration tests were added.

Before rollout certification, verify against a disposable database and authenticated runtime:
low and medium scores create offers with no generation; accepting twice creates only one run;
core continuation works while adaptive is offered/generating/failed/in progress; the last core
node completes the module; finishing older adaptive work preserves a newer core position; retakes
and worker redelivery do not add offers/nodes/XP; legacy required interventions are unlocked by the
migration without changing valid progress; ownership and archived-module checks remain enforced.

## Review cleanup

The adaptive page delegates content, concept scores and generation/status presentation to
feature-owned React components. Acceptance uses one shared hook with a stable command key and
an unmount guard so a delayed response cannot redirect a learner who already continued core work.
The contextual recommendation subscribes to generation updates, preventing stale progress/actions
when a learner revisits the assessment result. Both HTML prototypes remain standalone and their
JavaScript syntax was checked after formatting. Backend review found no additional concrete
correctness issue; authenticated end-to-end behavior retains the validation limits above.
