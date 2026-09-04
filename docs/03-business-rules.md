# Ngerti.in Business Rules Specification

## 1. Document Purpose

This document defines deterministic business rules for Ngerti.in v1.

These rules must not depend solely on AI output.

AI may generate content, summaries, feedback, or structured proposals, but application behavior is controlled by explicit business logic.

---

# 2. Authentication Rules

1. Clerk is the source of truth for authentication.
2. Every authenticated application user must map to one `users` record.
3. Application data ownership is based on the local user ID.
4. Authentication credentials are not stored in the Ngerti.in database.

---

# 3. Source Rules

## 3.1 Supported Source Types

```text
pdf
url
text
```

## 3.2 Source Ownership

A source belongs to exactly one user.

A user may reuse an existing source in multiple generation requests.

## 3.3 PDF Storage

PDF binary files must be stored in S3-compatible object storage.

PostgreSQL stores:

- File metadata
- Storage key
- Extracted content
- Source processing status

## 3.4 PDF Extraction

Extracted PDF content should be stored by page when page information is available.

This enables selectors such as:

```json
{
  "pages": {
    "from": 45,
    "to": 62
  }
}
```

without reprocessing the original file.

---

# 4. Generation Request Rules

1. A generation request belongs to one user.
2. A generation request must reference at least one source.
3. A generation request may reference multiple sources.
4. A generation request may include an optional instruction.
5. Instruction text must be stored separately from learning-material text.
6. Each source reference may define:
   - Role
   - Priority
   - Selector

Supported source roles:

```text
primary
reference
supplementary
```

---

# 5. Source Priority Rules

Recommended interpretation:

```text
primary
Highest authority for module content.

reference
Supporting information that may expand or clarify the primary source.

supplementary
Additional context with lower priority than primary content.
```

The generation pipeline must preserve source priority.

Conflicts should generally prefer higher-priority sources unless the instruction explicitly states otherwise.

---

# 6. Module Rules

1. A module is generated from one generation request.
2. A module belongs to one owner.
3. A module contains concepts and learning nodes.
4. Initial module generation creates only core nodes.
5. Adaptive nodes must not be created during initial generation.
6. Core curriculum must remain stable after the module reaches `ready`.
7. Adaptive content may supplement but must not remove or reorder core curriculum.

---

# 7. Module Status Rules

Supported module statuses:

```text
generating
ready
failed
archived
```

Transitions:

```text
generating → ready
generating → failed
ready → archived
failed → generating
```

A module must not be considered learnable until status is `ready`.

---

# 8. Concept Rules

1. Every generated module should contain one or more concepts.
2. Concept keys must be unique inside a module.
3. Concepts must represent meaningful learning targets.
4. Assessment nodes must map to at least one assessed concept.
5. Learning nodes may teach, review, or assess concepts.

Relation types:

```text
teach
review
assess
```

---

# 9. Core Node Rules

Core nodes must:

1. Belong to a module.
2. Have `origin = core`.
3. Have a valid `core_position`.
4. Have no `adaptive_intervention_id`.
5. Follow a deterministic ordering based on `core_position`.

Recommended core node types:

```text
lesson
flashcard
quiz
checkpoint
```

---

# 10. Adaptive Node Rules

Adaptive nodes must:

1. Belong to the same module as their intervention.
2. Have `origin = adaptive`.
3. Reference one `adaptive_intervention_id`.
4. Have an `adaptive_position`.
5. Be generated for a specific user's adaptive intervention.
6. Never change the core node order.

Recommended adaptive node types:

```text
review
practice
flashcard
remedial_quiz
```

---

# 11. Activity Rules

A node may contain one or more activities.

Activities must have a deterministic position within the node.

Initial supported activity types:

```text
lesson
flashcard
multiple_choice
true_false
short_answer
```

Activity content is stored separately from evaluation configuration.

Evaluation configuration must remain server-side.

---

# 12. Node Progress Rules

Node progress statuses:

```text
locked
available
in_progress
completed
```

Recommended state transitions:

```text
locked → available
available → in_progress
in_progress → completed
```

A completed node does not return to `locked`.

Re-attempting an assessment does not remove completion status.

---

# 13. Module Progress Rules

Module progress statuses:

```text
not_started
in_progress
completed
```

A module becomes `in_progress` when the user begins the first available core node.

A module becomes `completed` after all required core nodes are completed.

Adaptive nodes must not permanently increase the total number of core nodes used for module completion percentage.

Recommended progress calculation:

```text
completed_core_nodes / total_core_nodes * 100
```

---

# 14. Attempt Rules

1. Every assessment submission creates a new attempt.
2. Attempts are immutable historical records.
3. Re-attempts create additional attempt records.
4. `attempt_number` increments per user and activity.
5. `best_score` in `node_progress` may be updated when a better score is achieved.
6. Attempt responses must not be overwritten.

---

# 15. Assessment Rules

An assessment produces:

- Overall score
- Maximum score
- Structured evaluation
- Concept-level results
- Optional AI feedback

The application must not depend on AI feedback text for mastery calculations.

---

# 16. Concept Result Rules

For each relevant assessed concept, an attempt should produce a normalized performance score.

Recommended range:

```text
0.00 - 1.00
```

Example:

```text
digestive_organs      0.90
organ_functions       0.80
digestive_enzymes     0.32
```

---

# 17. Mastery Rules

Mastery is stored per:

```text
user
module
concept
```

Recommended initial values:

```text
mastery_score     0.00 - 1.00
confidence_score  0.00 - 1.00
```

`evidence_count` records how many assessment events contributed to the mastery state.

The exact update formula should be isolated in a mastery policy service.

---

# 18. Baseline Adaptive Policy

Recommended initial policy:

```text
mastery_score >= 0.75
→ continue core journey

mastery_score >= 0.50 and < 0.75
→ optional review

mastery_score < 0.50
→ adaptive intervention required
```

The thresholds should be configurable.

The AI model must not independently choose whether a learner requires remediation.

---

# 19. Adaptive Intervention Rules

An adaptive intervention is created when the adaptive policy requires additional learning support.

Each intervention must record:

- User
- Module
- Trigger node
- Trigger attempt
- Reason
- Resume node

Supported states:

```text
generating
available
in_progress
completed
failed
skipped
```

Recommended transition:

```text
generating
↓
available
↓
in_progress
↓
completed
```

Optional-review interventions may be skipped.

Required remediation should not be skipped in the default policy unless the product explicitly enables it.

---

# 20. Resume Node Rules

An adaptive intervention should define the core node where the learner resumes after completing the intervention.

Example:

```text
Core Node 3
↓
Quiz Attempt
↓
Adaptive Intervention
↓
Adaptive Review
↓
Adaptive Practice
↓
Resume Node = Core Node 4
```

---

# 21. Generation Rules

Initial module generation must run asynchronously.

The request lifecycle:

```text
Generation Request
↓
Module status = generating
↓
Generation Run
↓
Queue Job
↓
Background Worker
↓
Module status = ready or failed
```

The API must not keep the client request open for the entire generation process.

---

# 22. Generation Run Rules

A generation run represents one generation execution.

Types:

```text
module
adaptive
```

Statuses:

```text
queued
processing
completed
failed
```

A generation run should store the BullMQ job identifier when available.

---

# 23. Generation Step Rules

Recommended module-generation steps:

```text
extract_sources
analyze_material
create_concepts
create_curriculum
generate_activities
validate_module
```

Recommended adaptive-generation steps:

```text
analyze_weak_concepts
plan_remediation
generate_adaptive_activities
validate_adaptive_content
```

Each step has its own state.

---

# 24. Retry Rules

Retries must occur at the smallest safe unit possible.

A failed activity-generation step should not require source extraction to be repeated unless necessary.

Retry behavior must be idempotent.

The same BullMQ job must not create duplicate modules, nodes, or activities after retry.

---

# 25. Idempotency Rules

All background-generation write operations should be designed for safe retries.

Recommended approach:

- Use stable generation identifiers.
- Use transactions where appropriate.
- Check existing generated records before insert.
- Delete or replace only records owned by the active generation run when regeneration is intentional.
- Never rely on worker execution occurring exactly once.

---

# 26. Generation Failure Rules

If module generation cannot complete:

```text
generation_runs.status = failed
modules.status = failed
```

Failure information should be stored in structured form.

The user should see a recoverable failure state.

---

# 27. XP Rules

XP is recorded using `xp_events`.

XP must not exist only as a mutable total.

Supported initial reasons:

```text
node_completed
quiz_completed
perfect_score
checkpoint_completed
adaptive_completed
```

`user_stats.total_xp` is a cached aggregate and must remain reconcilable with the XP event ledger.

Completing a Core Node that contains only lesson and/or flashcard activities awards exactly `10 XP`.
The qualifying ledger entry uses reason `node_completed` and the Core Node ID as `reference_id`;
the tuple `(user_id, reason, reference_id)` is unique, so replay never awards XP twice.

---

# 28. Streak Rules

A learning day counts toward streak when the user performs at least one qualifying learning action.

The qualifying actions should be explicitly defined.

Recommended initial qualifying events:

```text
node_completed
quiz_completed
checkpoint_completed
adaptive_completed
```

Multiple events on the same calendar date count as one streak day.

Timezone handling must use the user's configured timezone when available.

---

# 29. Data Integrity Rules

The database should enforce:

- Foreign keys
- Unique user/module progress
- Unique user/node progress
- Unique module concept keys
- Valid mastery ranges
- Valid progress percentage ranges
- Core/adaptive node invariants

Application logic should additionally enforce cross-entity rules that are difficult to express as database constraints.

---

# 30. AI Responsibility Boundary

AI may:

- Analyze source content
- Propose concept structures
- Generate curriculum
- Generate activities
- Generate explanations
- Generate feedback
- Generate adaptive learning content

AI must not independently control:

- Authentication
- Data ownership
- Module status transitions
- Progress completion
- XP allocation
- Retry semantics
- Adaptive thresholds
- Mastery persistence
- Authorization
