# Main module generation: four continuously refilled slots

The main module workflow now dispatches activity nodes using LangGraph `Send`.
Each task owns text generation and image enrichment until both finish. The
coordinator dispatches all pending nodes; LangGraph immediately refills free
slots with a per-run `maxConcurrency: 4`. BullMQ worker concurrency remains one.
The same graph limit also allows up to four source-chunk analysis tasks.
This is a per-run limit, not a global provider limit across worker replicas.

The model, requests, output schemas, image search/inspection, retry policy,
adaptive generation, chat, public APIs, and database schema are unchanged.

## State and recovery

- `activities` merges updates by curriculum node key. Final persistence iterates
  curriculum order, independently of completion order.
- The existing `generate_activity` node is now the coordinator. Both its name and
  `activityIndex` remain readable by serial checkpoints. Pending work is derived
  from `activities`, even when the cursor disagrees.
- Streamed node completions publish progress using unique curriculum keys,
  including persisted pending writes on resume. The coordinator checks all
  results before completing the stage. Progress does not advance for text-only
  results whose image enrichment has not finished.
- PostgreSQL checkpoint durability stays synchronous. LangGraph pending writes
  preserve successful siblings when a task fails or the process dies. Work that
  had not checkpointed before termination can repeat.
- The activity step completes only when every curriculum node has a result.
  Finalization retains the existing transaction, run lock/status guard and
  curriculum-order inserts.
- Nested `AggregateError.errors` are traversed by the existing failure mapper.
  Known AI/source failures keep their existing public classification; unknown
  infrastructure failures remain eligible for existing BullMQ retries.

All activity tasks share one superstep, but the runner starts the next queued
task as soon as any slot is free. Successful task pending writes are persisted
individually; final merged state is checkpointed at the superstep boundary.
There is no custom scheduler or additional persistence layer.

Recovery means resuming the **same generation run** after worker interruption or
an existing automatic queue retry. The public retry endpoint still creates a
new generation run, as before; it does not reuse the failed run's checkpoint.

## Verification

Run the focused suite against a disposable/local PostgreSQL database:

```sh
MODULE_WORKFLOW_TEST_DATABASE_URL=postgresql://... bun test   apps/worker/src/modules/modules.workflow.spec.ts   apps/worker/src/modules/modules.failure.spec.ts
```

The workflow tests create random thread IDs in the `langgraph` schema and remove
only their own threads. Provider and application-service operations are fakes;
PostgreSQL and LangGraph are real. Coverage includes image-inclusive concurrency,
immediate slot refill while a sibling is still enriching, incremental progress,
out-of-order completion, old replacement-reducer checkpoints, an inconsistent
legacy cursor, one/two failed siblings, completed-run replay, and SIGKILL followed
by resume in a fresh process. The tests skip without the explicit database URL.

The temporary generation, quality-review and benchmark harnesses were removed
after validation. Historical aggregate results remain below; private artifacts
remain gitignored under `.experiments/`. No benchmark commands are shipped.

## Rollout and rollback

1. Stop dispatching/taking new module-generation jobs across every replica.
   Pause the BullMQ module queue; account for queued jobs already reserved by
   workers.
2. Let active jobs finish. Use graceful worker shutdown (`Worker.close()`) and
   a sufficient termination grace period; confirm no active jobs remain.
3. Before downgrade, also inspect delayed/stalled/failed jobs that may resume.
   Any unfinished run with `generate_activity_node` tasks needs this compatible
   version to finish. Active count zero alone is not sufficient.
4. Replace workers only after draining. Serial checkpoints can move forward to
   this version. Do not let an old binary resume a new parallel checkpoint.
   Complete those runs with compatible workers before rollback.
5. Resume queue consumption, monitor failure categories, generation progress,
   provider throttling, queue delay, and activity-stage latency.

No deployment is part of this change.

## Four-slot follow-up — 23 September 2026

Seven focused tests passed against local PostgreSQL, including cached-write
progress and fresh-process SIGKILL recovery. Two subsequent user-triggered runs
were audited against database records, queue metadata and graph checkpoints:

| Run | Processing | Activities stage | Nodes / activities | Images |
| --- | ---: | ---: | ---: | ---: |
| Photosynthesis, previous three-node batches | 269.68 s | 207.27 s | 13 / 54 | 13 |
| Photosynthesis, four slots | 115.68 s | 79.01 s | 13 / 62 | 11 |
| Scrum, four slots | 72.85 s | 43.71 s | 11 / 46 | 0 |

The photosynthesis runs used identical source references and generation settings.
Processing fell 57.1% and activity time fell 61.9%, but content and provider
latency varied, so this is not a controlled causal estimate. Scrum used different
source material and is not directly comparable.

Both four-slot runs completed on their first queue attempt without recorded
errors. Persisted nodes, activities, ordering and assessment configuration
matched their checkpoints. All 11 selected photosynthesis images were readable
from storage. Scrum requested four visuals; none passed candidate discovery or
relevance review, and no unresolved image references remained. Some selected
photosynthesis diagrams used foreign-language labels. These audits do not prove
comprehensive content quality or browser/grading acceptance. SDK-internal
retries and exact live peak concurrency were not measured by these audits.

## Measured local results — 22 September 2026 (three-node batches)

The user requested stopping additional verification once the implementation was
ready. The benchmark was drained after seven completed runs; the unstarted
queued fixture was removed. No benchmark job remains active or waiting. The
full 12-run acceptance matrix and broad content review were not completed.

| Fixture / run | Activity stage | Pipeline processing | Nodes / activities |
| --- | ---: | ---: | ---: |
| Quiz A1 | 27.61 s | 68.10 s | 4 / 12 |
| Quiz B1 | 17.12 s | 45.88 s | 4 / 13 |
| Quiz B2 | 14.42 s | 41.18 s | 5 / 14 |
| Quiz A2 | 36.86 s | 66.57 s | 5 / 15 |
| Short visual A1 | 179.04 s | 226.32 s | 5 / 24 |
| Short visual B1 | 114.64 s | 156.06 s | 5 / 26 |
| Short visual B2 | 72.45 s | 119.83 s | 5 / 23 |

Quiz averages improved approximately **51.1% for activities** and **35.4% for the
pipeline**, meeting both targets on that fixture. The first short-visual pair
improved **36.0% for activities** and **31.0% for the pipeline**: its activity
target was not met. A2 is missing for short visual, and long mixed was not run.
Do not present the overall performance acceptance as passed.

All seven runs completed on their first queue attempt, with no recorded
application retries or provider callback errors. Queue delay ranged from 1 to
13 ms. Text volume, image selections, model caching, and regenerated planning
vary; these small samples are not production performance guarantees.
The short-visual runs selected 7, 6, and 6 images respectively, using the
unchanged image inspection path.

[Aggregate measurements](./module-generation-parallel-results.json) include
per-stage durations, token usage, cached input, retries, and counts. Raw content,
image-review reasons, generated IDs and logs remain in private local artifacts.

Verification completed:

- Seven focused failure/recovery tests passed, including real PostgreSQL
  pending writes and SIGKILL/new-process recovery.
- Worker TypeScript, Nest build, scoped Biome checks and diff whitespace check
  passed.
- The full test suite exposed the existing schema-description assertion:
  `$.activities[].anyOf[0].type must have a description`. Both the schema and
  that test are unchanged; this change deliberately does not alter schemas.
- Authenticated local browser: parallel short-visual generation progressed from
  60% to 78% and then ready; the quiz journey showed curriculum order; a quiz
  answer could be selected and advanced to the next question; the photosynthesis
  lesson rendered, including a successfully loaded chloroplast image.
- Content review was a spot check of the displayed quiz and first visual lesson.
  It is not a comprehensive quality-equivalence result or assessment-grading
  acceptance test.

No deployment is included. Private experiment artifacts remain gitignored.
