import { relations, sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const source_type = pgEnum("source_type", ["pdf", "url", "text"]);
export const source_status = pgEnum("source_status", ["pending", "processing", "ready", "failed"]);
export const source_content_type = pgEnum("source_content_type", ["page", "section", "content"]);
export const source_processing_status = pgEnum("source_processing_status", [
  "queued",
  "processing",
  "completed",
  "failed",
]);
export const source_role = pgEnum("source_role", ["primary", "reference", "supplementary"]);
export const module_difficulty = pgEnum("module_difficulty", [
  "beginner",
  "intermediate",
  "advanced",
]);
export const module_status = pgEnum("module_status", ["generating", "ready", "failed", "archived"]);
export const node_origin = pgEnum("node_origin", ["core", "adaptive"]);
export const node_type = pgEnum("node_type", [
  "lesson",
  "flashcard",
  "quiz",
  "checkpoint",
  "review",
  "practice",
  "remedial_quiz",
]);
export const concept_relation = pgEnum("concept_relation", ["teach", "review", "assess"]);
export const activity_type = pgEnum("activity_type", [
  "lesson",
  "flashcard",
  "multiple_choice",
  "true_false",
  "short_answer",
]);
export const generation_type = pgEnum("generation_type", ["module", "adaptive"]);
export const generation_status = pgEnum("generation_status", [
  "queued",
  "processing",
  "completed",
  "failed",
]);
export const generation_step_status = pgEnum("generation_step_status", [
  "pending",
  "processing",
  "completed",
  "failed",
]);
export const module_progress_status = pgEnum("module_progress_status", [
  "not_started",
  "in_progress",
  "completed",
]);
export const node_progress_status = pgEnum("node_progress_status", [
  "locked",
  "available",
  "in_progress",
  "completed",
]);
export const adaptive_status = pgEnum("adaptive_status", [
  "offered",
  "generating",
  "available",
  "in_progress",
  "completed",
  "failed",
  "skipped",
]);
export const attempt_evaluation_status = pgEnum("attempt_evaluation_status", [
  "evaluating",
  "completed",
  "failed",
]);
export const attempt_policy_outcome = pgEnum("attempt_policy_outcome", [
  "continue",
  "optional_review",
  "required_intervention",
]);
export const xp_reason = pgEnum("xp_reason", [
  "node_completed",
  "quiz_completed",
  "perfect_score",
  "checkpoint_completed",
  "adaptive_completed",
]);

const createdAt = () => timestamp({ withTimezone: true, mode: "date" }).notNull().defaultNow();
const updatedAt = () =>
  timestamp({ withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());
const optionalTimestamp = () => timestamp({ withTimezone: true, mode: "date" });

export const users = pgTable(
  "users",
  {
    id: uuid().primaryKey().defaultRandom(),
    clerk_user_id: varchar().notNull(),
    display_name: varchar(),
    timezone: varchar().notNull().default("UTC"),
    created_at: createdAt(),
    updated_at: updatedAt(),
  },
  (table) => [uniqueIndex("users_clerk_user_id_idx").on(table.clerk_user_id)],
);

export const sources = pgTable(
  "sources",
  {
    id: uuid().primaryKey().defaultRandom(),
    user_id: uuid()
      .notNull()
      .references(() => users.id),
    type: source_type().notNull(),
    title: varchar(),
    archived_at: optionalTimestamp(),
    storage_key: varchar(),
    original_url: text(),
    text_content: text(),
    mime_type: varchar(),
    original_filename: varchar(),
    content_hash: varchar(),
    status: source_status().notNull(),
    metadata: jsonb(),
    failure: jsonb(),
    created_at: createdAt(),
    updated_at: updatedAt(),
  },
  (table) => [
    index("sources_user_id_idx").on(table.user_id),
    index("sources_user_created_id_idx").on(
      table.user_id,
      table.created_at.desc(),
      table.id.desc(),
    ),
    index("sources_status_idx").on(table.status),
    index("sources_content_hash_idx").on(table.content_hash),
  ],
);

export const idempotency_records = pgTable(
  "idempotency_records",
  {
    id: uuid().primaryKey().defaultRandom(),
    user_id: uuid()
      .notNull()
      .references(() => users.id),
    method: varchar({ length: 16 }).notNull(),
    route: varchar({ length: 255 }).notNull(),
    key: varchar({ length: 255 }).notNull(),
    payload_hash: varchar({ length: 64 }).notNull(),
    response_status: integer(),
    response_body: jsonb(),
    expires_at: timestamp({ withTimezone: true, mode: "date" }).notNull(),
    created_at: createdAt(),
  },
  (table) => [
    uniqueIndex("idempotency_records_scope_idx").on(
      table.user_id,
      table.method,
      table.route,
      table.key,
    ),
    index("idempotency_records_expires_at_idx").on(table.expires_at),
  ],
);

export const source_contents = pgTable(
  "source_contents",
  {
    id: uuid().primaryKey().defaultRandom(),
    source_id: uuid()
      .notNull()
      .references(() => sources.id),
    type: source_content_type().notNull(),
    position: integer().notNull(),
    page_number: integer(),
    heading: varchar(),
    content: text().notNull(),
    metadata: jsonb(),
    created_at: createdAt(),
  },
  (table) => [
    uniqueIndex("source_contents_source_position_idx").on(table.source_id, table.position),
    index("source_contents_source_page_idx").on(table.source_id, table.page_number),
    check("source_contents_position_check", sql`${table.position} > 0`),
    check(
      "source_contents_page_number_check",
      sql`${table.page_number} IS NULL OR ${table.page_number} > 0`,
    ),
  ],
);

export const source_processing_runs = pgTable(
  "source_processing_runs",
  {
    id: uuid().primaryKey().defaultRandom(),
    source_id: uuid()
      .notNull()
      .references(() => sources.id),
    bullmq_job_id: varchar(),
    status: source_processing_status().notNull(),
    error: jsonb(),
    metadata: jsonb(),
    started_at: optionalTimestamp(),
    finished_at: optionalTimestamp(),
    created_at: createdAt(),
  },
  (table) => [
    index("source_processing_runs_source_idx").on(table.source_id),
    index("source_processing_runs_status_created_idx").on(table.status, table.created_at),
    uniqueIndex("source_processing_runs_bullmq_job_idx")
      .on(table.bullmq_job_id)
      .where(sql`${table.bullmq_job_id} IS NOT NULL`),
    uniqueIndex("source_processing_runs_active_source_idx")
      .on(table.source_id)
      .where(sql`${table.status} IN ('queued', 'processing')`),
  ],
);

export const generation_requests = pgTable(
  "generation_requests",
  {
    id: uuid().primaryKey().defaultRandom(),
    user_id: uuid()
      .notNull()
      .references(() => users.id),
    instruction: text(),
    generation_settings: jsonb(),
    created_at: createdAt(),
  },
  (table) => [index("generation_requests_user_id_idx").on(table.user_id)],
);

export const generation_request_sources = pgTable(
  "generation_request_sources",
  {
    generation_request_id: uuid()
      .notNull()
      .references(() => generation_requests.id),
    source_id: uuid()
      .notNull()
      .references(() => sources.id),
    role: source_role().notNull(),
    priority: smallint().notNull(),
    selector: jsonb(),
    created_at: createdAt(),
  },
  (table) => [
    primaryKey({
      columns: [table.generation_request_id, table.source_id],
    }),
    index("generation_request_sources_source_id_idx").on(table.source_id),
    uniqueIndex("generation_request_sources_request_priority_idx").on(
      table.generation_request_id,
      table.priority,
    ),
  ],
);

export const modules = pgTable(
  "modules",
  {
    id: uuid().primaryKey().defaultRandom(),
    owner_id: uuid()
      .notNull()
      .references(() => users.id),
    generation_request_id: uuid()
      .notNull()
      .references(() => generation_requests.id),
    title: varchar(),
    description: text(),
    difficulty: module_difficulty(),
    status: module_status().notNull(),
    estimated_minutes: integer(),
    created_at: createdAt(),
    updated_at: updatedAt(),
  },
  (table) => [
    index("modules_owner_created_idx").on(table.owner_id, table.created_at),
    index("modules_owner_id_idx").on(table.owner_id),
    index("modules_owner_updated_id_idx").on(
      table.owner_id,
      table.updated_at.desc().nullsFirst(),
      table.id.desc().nullsFirst(),
    ),
    index("modules_status_idx").on(table.status),
    uniqueIndex("modules_generation_request_idx").on(table.generation_request_id),
    check(
      "modules_ready_title_check",
      sql`${table.status} NOT IN ('ready', 'archived') OR ${table.title} IS NOT NULL`,
    ),
  ],
);

export const module_concepts = pgTable(
  "module_concepts",
  {
    id: uuid().primaryKey().defaultRandom(),
    module_id: uuid()
      .notNull()
      .references(() => modules.id),
    key: varchar().notNull(),
    name: varchar().notNull(),
    description: text(),
    importance: numeric(),
    position: integer().notNull(),
    created_at: createdAt(),
  },
  (table) => [uniqueIndex("module_concepts_module_key_idx").on(table.module_id, table.key)],
);

export const module_nodes = pgTable(
  "module_nodes",
  {
    id: uuid().primaryKey().defaultRandom(),
    module_id: uuid()
      .notNull()
      .references(() => modules.id),
    origin: node_origin().notNull(),
    type: node_type().notNull(),
    title: varchar().notNull(),
    description: text(),
    core_position: integer(),
    adaptive_intervention_id: uuid().references((): AnyPgColumn => adaptive_interventions.id),
    adaptive_position: integer(),
    created_at: createdAt(),
    updated_at: updatedAt(),
  },
  (table) => [
    index("module_nodes_module_origin_idx").on(table.module_id, table.origin),
    uniqueIndex("module_nodes_core_position_idx")
      .on(table.module_id, table.core_position)
      .where(sql`${table.core_position} IS NOT NULL`),
    index("module_nodes_adaptive_intervention_idx").on(table.adaptive_intervention_id),
    uniqueIndex("module_nodes_adaptive_position_idx")
      .on(table.adaptive_intervention_id, table.adaptive_position)
      .where(sql`${table.adaptive_intervention_id} IS NOT NULL`),
    check(
      "module_nodes_origin_integrity_check",
      sql`(${table.origin} = 'core' AND ${table.core_position} IS NOT NULL AND ${table.adaptive_intervention_id} IS NULL AND ${table.adaptive_position} IS NULL) OR (${table.origin} = 'adaptive' AND ${table.core_position} IS NULL AND ${table.adaptive_intervention_id} IS NOT NULL AND ${table.adaptive_position} IS NOT NULL)`,
    ),
  ],
);

export const node_concepts = pgTable(
  "node_concepts",
  {
    node_id: uuid()
      .notNull()
      .references(() => module_nodes.id),
    concept_id: uuid()
      .notNull()
      .references(() => module_concepts.id),
    relation: concept_relation().notNull(),
    weight: numeric().notNull(),
  },
  (table) => [primaryKey({ columns: [table.node_id, table.concept_id] })],
);

export const activities = pgTable(
  "activities",
  {
    id: uuid().primaryKey().defaultRandom(),
    node_id: uuid()
      .notNull()
      .references(() => module_nodes.id),
    type: activity_type().notNull(),
    position: integer().notNull(),
    content: jsonb().notNull(),
    evaluation_config: jsonb(),
    schema_version: integer().notNull().default(1),
    created_at: createdAt(),
    updated_at: updatedAt(),
  },
  (table) => [uniqueIndex("activities_node_position_idx").on(table.node_id, table.position)],
);

export const generation_runs = pgTable(
  "generation_runs",
  {
    id: uuid().primaryKey().defaultRandom(),
    user_id: uuid()
      .notNull()
      .references(() => users.id),
    module_id: uuid()
      .notNull()
      .references(() => modules.id),
    generation_request_id: uuid().references(() => generation_requests.id),
    adaptive_intervention_id: uuid().references((): AnyPgColumn => adaptive_interventions.id),
    type: generation_type().notNull(),
    bullmq_job_id: varchar(),
    status: generation_status().notNull(),
    progress_percentage: integer().notNull(),
    error: jsonb(),
    metadata: jsonb(),
    started_at: optionalTimestamp(),
    finished_at: optionalTimestamp(),
    created_at: createdAt(),
  },
  (table) => [
    index("generation_runs_user_active_idx")
      .on(table.user_id)
      .where(sql`${table.type} = 'module' and ${table.status} in ('queued', 'processing')`),
    index("generation_runs_module_idx").on(table.module_id),
    index("generation_runs_status_idx").on(table.status),
    uniqueIndex("generation_runs_bullmq_job_idx")
      .on(table.bullmq_job_id)
      .where(sql`${table.bullmq_job_id} IS NOT NULL`),
    uniqueIndex("generation_runs_adaptive_intervention_idx")
      .on(table.adaptive_intervention_id)
      .where(sql`${table.adaptive_intervention_id} IS NOT NULL`),
    check(
      "generation_runs_type_integrity_check",
      sql`(${table.type} = 'module' AND ${table.generation_request_id} IS NOT NULL AND ${table.adaptive_intervention_id} IS NULL) OR (${table.type} = 'adaptive' AND ${table.generation_request_id} IS NULL AND ${table.adaptive_intervention_id} IS NOT NULL)`,
    ),
    check(
      "generation_runs_progress_percentage_check",
      sql`${table.progress_percentage} >= 0 AND ${table.progress_percentage} <= 100`,
    ),
  ],
);

export const generation_run_steps = pgTable(
  "generation_run_steps",
  {
    id: uuid().primaryKey().defaultRandom(),
    generation_run_id: uuid()
      .notNull()
      .references(() => generation_runs.id),
    step: varchar().notNull(),
    position: integer().notNull(),
    status: generation_step_status().notNull(),
    metadata: jsonb(),
    error: jsonb(),
    started_at: optionalTimestamp(),
    finished_at: optionalTimestamp(),
  },
  (table) => [
    uniqueIndex("generation_run_steps_run_position_idx").on(
      table.generation_run_id,
      table.position,
    ),
  ],
);

export const user_module_progress = pgTable(
  "user_module_progress",
  {
    id: uuid().primaryKey().defaultRandom(),
    user_id: uuid()
      .notNull()
      .references(() => users.id),
    module_id: uuid()
      .notNull()
      .references(() => modules.id),
    status: module_progress_status().notNull(),
    current_node_id: uuid().references(() => module_nodes.id),
    progress_percentage: numeric().notNull(),
    started_at: optionalTimestamp(),
    completed_at: optionalTimestamp(),
    updated_at: updatedAt(),
  },
  (table) => [
    uniqueIndex("user_module_progress_user_module_idx").on(table.user_id, table.module_id),
    index("user_module_progress_user_status_updated_module_idx").on(
      table.user_id,
      table.status,
      table.updated_at.desc().nullsFirst(),
      table.module_id.desc().nullsFirst(),
    ),
    check(
      "user_module_progress_percentage_check",
      sql`${table.progress_percentage} >= 0 AND ${table.progress_percentage} <= 100`,
    ),
  ],
);

export const node_progress = pgTable(
  "node_progress",
  {
    id: uuid().primaryKey().defaultRandom(),
    user_id: uuid()
      .notNull()
      .references(() => users.id),
    node_id: uuid()
      .notNull()
      .references(() => module_nodes.id),
    status: node_progress_status().notNull(),
    best_score: numeric(),
    attempt_count: integer().notNull().default(0),
    started_at: optionalTimestamp(),
    completed_at: optionalTimestamp(),
    updated_at: updatedAt(),
  },
  (table) => [
    uniqueIndex("node_progress_user_node_idx").on(table.user_id, table.node_id),
    check(
      "node_progress_best_score_check",
      sql`${table.best_score} IS NULL OR (${table.best_score} >= 0 AND ${table.best_score} <= 1)`,
    ),
    check("node_progress_attempt_count_check", sql`${table.attempt_count} >= 0`),
  ],
);

export const attempts = pgTable(
  "attempts",
  {
    id: uuid().primaryKey().defaultRandom(),
    user_id: uuid()
      .notNull()
      .references(() => users.id),
    module_id: uuid()
      .notNull()
      .references(() => modules.id),
    node_id: uuid()
      .notNull()
      .references(() => module_nodes.id),
    submission_id: uuid().notNull(),
    submission_hash: varchar({ length: 64 }).notNull(),
    attempt_number: integer().notNull(),
    evaluation_status: attempt_evaluation_status().notNull(),
    score: numeric(),
    max_score: numeric(),
    policy_outcome: attempt_policy_outcome(),
    feedback: jsonb(),
    xp_awarded: integer().notNull().default(0),
    failure: jsonb(),
    evaluated_at: optionalTimestamp(),
    created_at: createdAt(),
  },
  (table) => [
    index("attempts_user_module_idx").on(table.user_id, table.module_id),
    index("attempts_node_idx").on(table.node_id),
    index("attempts_evaluating_idx")
      .on(table.created_at, table.id)
      .where(sql`${table.evaluation_status} = 'evaluating'`),
    uniqueIndex("attempts_user_submission_idx").on(table.user_id, table.submission_id),
    uniqueIndex("attempts_user_node_number_idx").on(
      table.user_id,
      table.node_id,
      table.attempt_number,
    ),
    check("attempts_attempt_number_check", sql`${table.attempt_number} > 0`),
    check(
      "attempts_score_check",
      sql`${table.score} IS NULL OR (${table.score} >= 0 AND ${table.max_score} IS NOT NULL AND ${table.score} <= ${table.max_score})`,
    ),
    check("attempts_max_score_check", sql`${table.max_score} IS NULL OR ${table.max_score} > 0`),
    check("attempts_xp_awarded_check", sql`${table.xp_awarded} >= 0`),
  ],
);

export const attempt_responses = pgTable(
  "attempt_responses",
  {
    attempt_id: uuid()
      .notNull()
      .references(() => attempts.id),
    activity_id: uuid()
      .notNull()
      .references(() => activities.id),
    response: jsonb().notNull(),
    score: numeric(),
    max_score: numeric(),
    evaluation: jsonb(),
    created_at: createdAt(),
  },
  (table) => [
    primaryKey({ columns: [table.attempt_id, table.activity_id] }),
    index("attempt_responses_activity_idx").on(table.activity_id),
    check(
      "attempt_responses_score_check",
      sql`${table.score} IS NULL OR (${table.score} >= 0 AND ${table.max_score} IS NOT NULL AND ${table.score} <= ${table.max_score})`,
    ),
    check(
      "attempt_responses_max_score_check",
      sql`${table.max_score} IS NULL OR ${table.max_score} > 0`,
    ),
  ],
);

export const attempt_concept_results = pgTable(
  "attempt_concept_results",
  {
    attempt_id: uuid()
      .notNull()
      .references(() => attempts.id),
    concept_id: uuid()
      .notNull()
      .references(() => module_concepts.id),
    performance_score: numeric().notNull(),
    mastery_score: numeric().notNull(),
    confidence_score: numeric().notNull(),
    evidence_count: integer().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.attempt_id, table.concept_id] }),
    check(
      "attempt_concept_results_performance_score_check",
      sql`${table.performance_score} >= 0 AND ${table.performance_score} <= 1`,
    ),
    check(
      "attempt_concept_results_mastery_score_check",
      sql`${table.mastery_score} >= 0 AND ${table.mastery_score} <= 1`,
    ),
    check(
      "attempt_concept_results_confidence_score_check",
      sql`${table.confidence_score} >= 0 AND ${table.confidence_score} <= 1`,
    ),
    check("attempt_concept_results_evidence_count_check", sql`${table.evidence_count} > 0`),
  ],
);

export const user_concept_mastery = pgTable(
  "user_concept_mastery",
  {
    user_id: uuid()
      .notNull()
      .references(() => users.id),
    module_id: uuid()
      .notNull()
      .references(() => modules.id),
    concept_id: uuid()
      .notNull()
      .references(() => module_concepts.id),
    mastery_score: numeric().notNull(),
    confidence_score: numeric().notNull(),
    evidence_count: integer().notNull(),
    updated_at: updatedAt(),
  },
  (table) => [
    primaryKey({
      columns: [table.user_id, table.module_id, table.concept_id],
    }),
    index("user_concept_mastery_module_idx").on(table.user_id, table.module_id),
    check(
      "user_concept_mastery_mastery_score_check",
      sql`${table.mastery_score} >= 0 AND ${table.mastery_score} <= 1`,
    ),
    check(
      "user_concept_mastery_confidence_score_check",
      sql`${table.confidence_score} >= 0 AND ${table.confidence_score} <= 1`,
    ),
    check("user_concept_mastery_evidence_count_check", sql`${table.evidence_count} > 0`),
  ],
);

export const adaptive_interventions = pgTable(
  "adaptive_interventions",
  {
    id: uuid().primaryKey().defaultRandom(),
    user_id: uuid()
      .notNull()
      .references(() => users.id),
    module_id: uuid()
      .notNull()
      .references(() => modules.id),
    trigger_node_id: uuid()
      .notNull()
      .references(() => module_nodes.id),
    trigger_attempt_id: uuid()
      .notNull()
      .references(() => attempts.id),
    resume_node_id: uuid().references(() => module_nodes.id),
    reason_code: varchar().notNull(),
    reason_summary: text(),
    required: boolean().notNull().default(false),
    status: adaptive_status().notNull(),
    created_at: createdAt(),
    completed_at: optionalTimestamp(),
  },
  (table) => [
    index("adaptive_interventions_user_module_idx").on(table.user_id, table.module_id),
    index("adaptive_interventions_status_idx").on(table.status),
    uniqueIndex("adaptive_interventions_trigger_attempt_idx").on(table.trigger_attempt_id),
  ],
);

export const adaptive_intervention_concepts = pgTable(
  "adaptive_intervention_concepts",
  {
    adaptive_intervention_id: uuid()
      .notNull()
      .references(() => adaptive_interventions.id),
    concept_id: uuid()
      .notNull()
      .references(() => module_concepts.id),
    mastery_score: numeric().notNull(),
    created_at: createdAt(),
  },
  (table) => [
    primaryKey({ columns: [table.adaptive_intervention_id, table.concept_id] }),
    index("adaptive_intervention_concepts_concept_idx").on(table.concept_id),
    check(
      "adaptive_intervention_concepts_mastery_score_check",
      sql`${table.mastery_score} >= 0 AND ${table.mastery_score} <= 1`,
    ),
  ],
);

export const user_stats = pgTable("user_stats", {
  user_id: uuid()
    .primaryKey()
    .references(() => users.id),
  total_xp: integer().notNull().default(0),
  current_streak: integer().notNull().default(0),
  longest_streak: integer().notNull().default(0),
  last_learning_date: date({ mode: "string" }),
  updated_at: updatedAt(),
});

export const xp_events = pgTable(
  "xp_events",
  {
    id: uuid().primaryKey().defaultRandom(),
    user_id: uuid()
      .notNull()
      .references(() => users.id),
    module_id: uuid().references(() => modules.id),
    amount: integer().notNull(),
    reason: xp_reason().notNull(),
    reference_id: uuid(),
    created_at: createdAt(),
  },
  (table) => [
    index("xp_events_user_created_idx").on(table.user_id, table.created_at.desc()),
    uniqueIndex("xp_events_user_reason_reference_idx").on(
      table.user_id,
      table.reason,
      table.reference_id,
    ),
  ],
);

export const usersRelations = relations(users, ({ many, one }) => ({
  sources: many(sources),
  idempotency_records: many(idempotency_records),
  generation_requests: many(generation_requests),
  modules: many(modules),
  generation_runs: many(generation_runs),
  user_module_progress: many(user_module_progress),
  node_progress: many(node_progress),
  attempts: many(attempts),
  user_concept_mastery: many(user_concept_mastery),
  adaptive_interventions: many(adaptive_interventions),
  user_stats: one(user_stats),
  xp_events: many(xp_events),
}));

export const idempotencyRecordsRelations = relations(idempotency_records, ({ one }) => ({
  user: one(users, {
    fields: [idempotency_records.user_id],
    references: [users.id],
  }),
}));

export const sourcesRelations = relations(sources, ({ many, one }) => ({
  user: one(users, {
    fields: [sources.user_id],
    references: [users.id],
  }),
  source_contents: many(source_contents),
  processing_runs: many(source_processing_runs),
  generation_request_sources: many(generation_request_sources),
}));

export const sourceProcessingRunsRelations = relations(source_processing_runs, ({ one }) => ({
  source: one(sources, {
    fields: [source_processing_runs.source_id],
    references: [sources.id],
  }),
}));

export const sourceContentsRelations = relations(source_contents, ({ one }) => ({
  source: one(sources, {
    fields: [source_contents.source_id],
    references: [sources.id],
  }),
}));

export const generationRequestsRelations = relations(generation_requests, ({ many, one }) => ({
  user: one(users, {
    fields: [generation_requests.user_id],
    references: [users.id],
  }),
  generation_request_sources: many(generation_request_sources),
  modules: many(modules),
  generation_runs: many(generation_runs),
}));

export const generationRequestSourcesRelations = relations(
  generation_request_sources,
  ({ one }) => ({
    generation_request: one(generation_requests, {
      fields: [generation_request_sources.generation_request_id],
      references: [generation_requests.id],
    }),
    source: one(sources, {
      fields: [generation_request_sources.source_id],
      references: [sources.id],
    }),
  }),
);

export const modulesRelations = relations(modules, ({ many, one }) => ({
  owner: one(users, {
    fields: [modules.owner_id],
    references: [users.id],
  }),
  generation_request: one(generation_requests, {
    fields: [modules.generation_request_id],
    references: [generation_requests.id],
  }),
  concepts: many(module_concepts),
  nodes: many(module_nodes),
  generation_runs: many(generation_runs),
  user_module_progress: many(user_module_progress),
  attempts: many(attempts),
  user_concept_mastery: many(user_concept_mastery),
  adaptive_interventions: many(adaptive_interventions),
  xp_events: many(xp_events),
}));

export const moduleConceptsRelations = relations(module_concepts, ({ many, one }) => ({
  module: one(modules, {
    fields: [module_concepts.module_id],
    references: [modules.id],
  }),
  node_concepts: many(node_concepts),
  attempt_concept_results: many(attempt_concept_results),
  user_concept_mastery: many(user_concept_mastery),
  adaptive_intervention_concepts: many(adaptive_intervention_concepts),
}));

export const moduleNodesRelations = relations(module_nodes, ({ many, one }) => ({
  module: one(modules, {
    fields: [module_nodes.module_id],
    references: [modules.id],
  }),
  adaptive_intervention: one(adaptive_interventions, {
    fields: [module_nodes.adaptive_intervention_id],
    references: [adaptive_interventions.id],
    relationName: "adaptive_nodes",
  }),
  node_concepts: many(node_concepts),
  activities: many(activities),
  node_progress: many(node_progress),
  attempts: many(attempts),
  current_for_progress: many(user_module_progress),
  triggered_interventions: many(adaptive_interventions, {
    relationName: "trigger_node",
  }),
  resumed_interventions: many(adaptive_interventions, {
    relationName: "resume_node",
  }),
}));

export const nodeConceptsRelations = relations(node_concepts, ({ one }) => ({
  node: one(module_nodes, {
    fields: [node_concepts.node_id],
    references: [module_nodes.id],
  }),
  concept: one(module_concepts, {
    fields: [node_concepts.concept_id],
    references: [module_concepts.id],
  }),
}));

export const activitiesRelations = relations(activities, ({ many, one }) => ({
  node: one(module_nodes, {
    fields: [activities.node_id],
    references: [module_nodes.id],
  }),
  attempt_responses: many(attempt_responses),
}));

export const generationRunsRelations = relations(generation_runs, ({ many, one }) => ({
  user: one(users, {
    fields: [generation_runs.user_id],
    references: [users.id],
  }),
  module: one(modules, {
    fields: [generation_runs.module_id],
    references: [modules.id],
  }),
  generation_request: one(generation_requests, {
    fields: [generation_runs.generation_request_id],
    references: [generation_requests.id],
  }),
  adaptive_intervention: one(adaptive_interventions, {
    fields: [generation_runs.adaptive_intervention_id],
    references: [adaptive_interventions.id],
  }),
  steps: many(generation_run_steps),
}));

export const generationRunStepsRelations = relations(generation_run_steps, ({ one }) => ({
  generation_run: one(generation_runs, {
    fields: [generation_run_steps.generation_run_id],
    references: [generation_runs.id],
  }),
}));

export const userModuleProgressRelations = relations(user_module_progress, ({ one }) => ({
  user: one(users, {
    fields: [user_module_progress.user_id],
    references: [users.id],
  }),
  module: one(modules, {
    fields: [user_module_progress.module_id],
    references: [modules.id],
  }),
  current_node: one(module_nodes, {
    fields: [user_module_progress.current_node_id],
    references: [module_nodes.id],
  }),
}));

export const nodeProgressRelations = relations(node_progress, ({ one }) => ({
  user: one(users, {
    fields: [node_progress.user_id],
    references: [users.id],
  }),
  node: one(module_nodes, {
    fields: [node_progress.node_id],
    references: [module_nodes.id],
  }),
}));

export const attemptsRelations = relations(attempts, ({ many, one }) => ({
  user: one(users, {
    fields: [attempts.user_id],
    references: [users.id],
  }),
  module: one(modules, {
    fields: [attempts.module_id],
    references: [modules.id],
  }),
  node: one(module_nodes, {
    fields: [attempts.node_id],
    references: [module_nodes.id],
  }),
  responses: many(attempt_responses),
  concept_results: many(attempt_concept_results),
  triggered_interventions: many(adaptive_interventions),
}));

export const attemptResponsesRelations = relations(attempt_responses, ({ one }) => ({
  attempt: one(attempts, {
    fields: [attempt_responses.attempt_id],
    references: [attempts.id],
  }),
  activity: one(activities, {
    fields: [attempt_responses.activity_id],
    references: [activities.id],
  }),
}));

export const attemptConceptResultsRelations = relations(attempt_concept_results, ({ one }) => ({
  attempt: one(attempts, {
    fields: [attempt_concept_results.attempt_id],
    references: [attempts.id],
  }),
  concept: one(module_concepts, {
    fields: [attempt_concept_results.concept_id],
    references: [module_concepts.id],
  }),
}));

export const userConceptMasteryRelations = relations(user_concept_mastery, ({ one }) => ({
  user: one(users, {
    fields: [user_concept_mastery.user_id],
    references: [users.id],
  }),
  module: one(modules, {
    fields: [user_concept_mastery.module_id],
    references: [modules.id],
  }),
  concept: one(module_concepts, {
    fields: [user_concept_mastery.concept_id],
    references: [module_concepts.id],
  }),
}));

export const adaptiveInterventionsRelations = relations(
  adaptive_interventions,
  ({ many, one }) => ({
    user: one(users, {
      fields: [adaptive_interventions.user_id],
      references: [users.id],
    }),
    module: one(modules, {
      fields: [adaptive_interventions.module_id],
      references: [modules.id],
    }),
    trigger_node: one(module_nodes, {
      fields: [adaptive_interventions.trigger_node_id],
      references: [module_nodes.id],
      relationName: "trigger_node",
    }),
    trigger_attempt: one(attempts, {
      fields: [adaptive_interventions.trigger_attempt_id],
      references: [attempts.id],
    }),
    resume_node: one(module_nodes, {
      fields: [adaptive_interventions.resume_node_id],
      references: [module_nodes.id],
      relationName: "resume_node",
    }),
    adaptive_nodes: many(module_nodes, {
      relationName: "adaptive_nodes",
    }),
    generation_runs: many(generation_runs),
    concepts: many(adaptive_intervention_concepts),
  }),
);

export const adaptiveInterventionConceptsRelations = relations(
  adaptive_intervention_concepts,
  ({ one }) => ({
    adaptive_intervention: one(adaptive_interventions, {
      fields: [adaptive_intervention_concepts.adaptive_intervention_id],
      references: [adaptive_interventions.id],
    }),
    concept: one(module_concepts, {
      fields: [adaptive_intervention_concepts.concept_id],
      references: [module_concepts.id],
    }),
  }),
);

export const userStatsRelations = relations(user_stats, ({ one }) => ({
  user: one(users, {
    fields: [user_stats.user_id],
    references: [users.id],
  }),
}));

export const xpEventsRelations = relations(xp_events, ({ one }) => ({
  user: one(users, {
    fields: [xp_events.user_id],
    references: [users.id],
  }),
  module: one(modules, {
    fields: [xp_events.module_id],
    references: [modules.id],
  }),
}));
