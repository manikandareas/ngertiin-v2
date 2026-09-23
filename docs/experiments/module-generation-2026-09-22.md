# Module generation concurrency and Jev experiment — 22 September 2026

Historical report: the temporary experiment harnesses were removed after validation.
Descriptions of those harnesses below document the original measurement setup.

**Decision supported by this pilot: implement bounded node concurrency before changing the generator; do not adopt the tested alternate-model/Jev cascade as a quality-preserving replacement yet.** Three concurrent nodes reduced measured activity-stage wall time by 55–65% on these fixtures. Automated text review did not show a systematic quality regression for concurrency, but preferred the baseline generator over the cascade in 9 of 10 quiz comparisons. This is not a full-module production benchmark or proof of human-rated quality equivalence.

## What was measured

Three existing local generation checkpoints supplied frozen curricula and current source text: a five-node Scrum quiz, a five-node photosynthesis module, and a thirteen-node photosynthesis module. Both photosynthesis fixtures allow lessons, flashcards, and quizzes. Each variant used identical per-node prompt hashes, source data, concept maps, instructions, and settings.

The harness imports the production model factory, request builder, output schemas, and `LessonImagesService`. It performs real provider calls, Commons searches, thumbnail downloads, and visual inspection. Image bytes are written locally and diagnostics are captured locally. Application tables, queues, storage objects, and LangGraph checkpoints are not modified.

Queueing, OCR/extraction, analysis, concept/curriculum planning, LangGraph persistence, final database writes, and production S3 latency are excluded. Results below are **activity-generation stage times**, not complete module delivery times. Sources and generated answer keys remain in the gitignored `.experiments/` directory.

| Variant | Generator | Concurrent nodes | Jev |
| --- | --- | ---: | --- |
| A | Configured `gpt-5.6-luna` | 1 | None |
| B | Same `gpt-5.6-luna` | 3 | None |
| C | `gpt-5.4-mini-2026-03-17` | 3 | Semantic checks; fallback to baseline generator on a flag/failure |
| D | Same alternate generator as C | 3 | None; control for verifier overhead |

Each node slot includes both text and image enrichment, matching production's ordering within a node. Vision still uses the baseline model. C/D were limited to the quiz-only fixture because the full photosynthesis verification payload exceeded Jev's context budget.

A/B ran twice per fixture in counterbalanced order: A then B, followed by B then A. C/D ran D1, C1, C2, D2. Variants were not timed concurrently. Review-model calls started only after timing trials finished.

## Measured latency

| Fixture | A run 1 / run 2 | B run 1 / run 2 | A mean | B mean | Reduction |
| --- | ---: | ---: | ---: | ---: | ---: |
| Quiz-only, 5 nodes | 38.1 / 29.2 s | 12.9 / 16.9 s | 33.6 s | 14.9 s | 55.7% |
| Short visual, 5 nodes | 174.8 / 126.4 s | 76.9 / 59.8 s | 150.6 s | 68.4 s | 54.6% |
| Long mixed, 13 nodes | 417.7 / 287.0 s | 127.6 / 116.8 s | 352.3 s | 122.2 s | 65.3% |

Caching is a material confound. In the first long-module pair, recorded cached-input shares were about 2.7% for A and 88.3% for B. In the second pair they were approximately 87% and 88%; the second-pair reduction remained **59.3%**. Therefore the first pair's 69.5% reduction must not be attributed entirely to concurrency.

Content volume also varied, despite identical prompts. Across the two long-module repetitions, A produced 123 activities and B 121; average learner-visible content was about 84.6k versus 80.3k characters. Short-module learner-visible content averaged 32.6k versus 33.0k characters. No content-length limit was reduced by the experiment.

There were 16 timing trials and 112 generated nodes, including the C/D pilot. All nodes passed the output schema and concept-reference checks. No application-level invalid-output retries or node failures were recorded. Internal SDK HTTP retries are not fully observable from these logs.

## Automated text review

`gpt-5.6-sol` reviewed anonymous X/Y outputs against the same evidence. Label order was assigned by a deterministic hash; model names, concurrency, and latency were omitted from the judge prompt. It reviewed all 46 A/B node pairs, scoring each dimension from 1 to 5.

| Dimension | A mean | B mean |
| --- | ---: | ---: |
| Accuracy / grounding | 4.609 | 4.696 |
| Target coverage | 4.739 | 4.848 |
| Pedagogical clarity | 4.935 | 4.891 |
| Assessment quality | 4.935 | 4.978 |

The reviewer preferred B in 15 pairs, A in 10, and considered 21 equivalent. It flagged issues in 15 A outputs and 9 B outputs. These are **reviewer flags, not independently confirmed error counts**: some depend on how broadly a concept should be covered by a particular node. For example, the judge sometimes required the historical part of a combined “foundations and history” concept even in a checkpoint focused on energy and carbon.

One concrete coverage gap appeared in both variants: the Scrum Team/Values/Sprint node sometimes omitted the five Scrum values despite listing values in its title and learning objective. Schema validity and correct concept IDs did not catch that omission.

These results support trying concurrency without changing the model, but do not establish statistical non-inferiority or human acceptance. Review was per node and text-only; it does not certify every image, cross-node coherence, or factual correctness independent of the supplied sources. One selected Calvin-cycle image was inspected manually as a spot check, not as a complete visual evaluation.

## Jev pilot

On the quiz-only fixture, mean times were:

| Configuration | Mean activity-stage time |
| --- | ---: |
| Baseline model, parallel (B) | 14.91 s |
| Alternate model + Jev (C) | 11.02 s |
| Alternate model alone (D) | 8.25 s |

C was 26.1% faster than B, but Jev added approximately 2.77 seconds compared with D. The speed gain came from the alternate generator; the verifier was additional work. No original C node triggered fallback, so this pilot does not demonstrate quality improvements from repairing real generated failures.

C produced 31 assessment activities across two repetitions versus B's 36, and approximately 27% less learner-visible text. The separate blind review favored B in **9 of 10 pairs**, with one tie and no C preference:

| Dimension | B: baseline parallel | C: alternate + Jev |
| --- | ---: | ---: |
| Accuracy / grounding | 5.0 | 4.6 |
| Target coverage | 4.8 | 4.1 |
| Pedagogical clarity | 4.9 | 4.2 |
| Assessment quality | 4.9 | 4.3 |

Manual inspection confirmed examples behind two flags: a C short-answer question requests **two** Developer responsibilities but assigns scoring weight to **three** separate required categories; another C true/false statement says an Increment can be “part of an Increment,” whereas its own explanation refers to **work** becoming part of an Increment. Jev did not escalate either output. The present gate is insufficient for preserving the baseline's coverage and assessment design.

The C/D review preferred each variant in four pairs, with two ties; it did not establish a quality benefit from adding Jev on these original outputs. Since no C fallback occurred, observed C/D content differences come from separate stochastic generations, not verifier repairs. Reviewer scores/flags vary with the comparison partner and are not calibrated ground truth. All **66 paired reviews** (46 A/B, 10 B/C, 10 D/C) are complete and recorded in the evidence and local artifacts.

### Verifier input matters

The initial verifier saw multiple-choice keys as numeric option indices. With a fixed, experimental escalation threshold of 0.7, it caught only **3 of 5** deliberately swapped answer keys. The missed cases had bad-key probabilities of 0.30 and 0.41.

The revised verifier resolves the selected option text in code and asks whether that text is the correct answer. At the same threshold it caught **5/5** original mutation cases and **5/5** additional cases from B outputs. None of the ten unmodified A/B quiz outputs triggered that threshold. This is a small diagnostic sample, not calibration or a general accuracy guarantee. The first five cases influenced the revision and are not a held-out test set.

Eight separate Indonesian claim/source controls had 7/8 agreement with the predefined labels. The disagreement was between “insufficient evidence” and “contradiction.”

The verifier checks material unsupported claims, off-target activities, incorrect selected answers, and ambiguous multiple-choice options. It does **not** exhaustively check coverage of every required subtopic. Its success on swapped keys must not be generalized to lesson completeness or mathematical proof.

### Context and cost boundaries

Sending the entire photosynthesis lesson request plus output to `jev-1.13.0` returned HTTP 400 with `max_tokens_exceeded`. No evidence was silently truncated to make this trial pass. A production design would need explicit evidence selection or decomposition, plus tests for errors caused by omitted evidence. Jev's documented text-only input also prevents replacing the existing visual review. See the [model limits](https://docs.typesafe.ai/models) and [API contract](https://docs.typesafe.ai/api).

The two C runs used 89,144 Jev input tokens over ten verifier requests. At the documented $0.042 per million input tokens, verifier inference alone is approximately **$0.00374 total**, or $0.00187 per five-node quiz module. This is a rate-based estimate, not a billing receipt, and excludes generator calls, controls, review, and retries. Full OpenAI dollar cost is not established: the first three timing runs lack usage-callback coverage, and no authoritative price mapping for the configured baseline model was recorded.

## Recommended next implementation

1. Implement at most three concurrent node-generation slots while preserving the current model, prompts, schemas, image inspection, and output order.
2. Merge results by node key. The current graph's replacement reducer cannot simply be reused for parallel node updates. Preserve completed sibling work and checkpoint progress safely on retries.
3. Measure a complete module run, including persistence and queueing, then perform an authenticated product check and broader content review.
4. Keep the alternate-model/Jev cascade experimental. Add coverage-specific checks and evaluate a larger held-out set before making it a quality gate. Solve full-evidence context handling before extending it to photosynthesis-sized lessons.

If activities account for 80% of a five-minute end-to-end run, a 55% reduction in that stage projects to about **2 minutes 48 seconds overall**. That is an illustrative projection, not an observed full-module result.

## Reproduction and artifacts

- Temporary harnesses and their command README were removed after validation.
- Aggregate evidence: [module-generation-2026-09-22.json](./module-generation-2026-09-22.json).
- Private local inputs, raw outputs, images, logs, mutation controls, and anonymous reviews: `.experiments/module-generation/`.
- Checks passed: worker TypeScript check, worker Nest build, Biome checks on the experimental TypeScript, Python syntax check, and `git diff --check`.

No production generation code was changed and no deployment or commit was performed.
