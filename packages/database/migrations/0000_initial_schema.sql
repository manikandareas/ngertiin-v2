CREATE TYPE "public"."activity_type" AS ENUM('lesson', 'flashcard', 'multiple_choice', 'true_false', 'short_answer');--> statement-breakpoint
CREATE TYPE "public"."adaptive_status" AS ENUM('generating', 'available', 'in_progress', 'completed', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."concept_relation" AS ENUM('teach', 'review', 'assess');--> statement-breakpoint
CREATE TYPE "public"."generation_status" AS ENUM('queued', 'processing', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."generation_step_status" AS ENUM('pending', 'processing', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."generation_type" AS ENUM('module', 'adaptive');--> statement-breakpoint
CREATE TYPE "public"."module_difficulty" AS ENUM('beginner', 'intermediate', 'advanced');--> statement-breakpoint
CREATE TYPE "public"."module_progress_status" AS ENUM('not_started', 'in_progress', 'completed');--> statement-breakpoint
CREATE TYPE "public"."module_status" AS ENUM('generating', 'ready', 'failed', 'archived');--> statement-breakpoint
CREATE TYPE "public"."node_origin" AS ENUM('core', 'adaptive');--> statement-breakpoint
CREATE TYPE "public"."node_progress_status" AS ENUM('locked', 'available', 'in_progress', 'completed');--> statement-breakpoint
CREATE TYPE "public"."node_type" AS ENUM('lesson', 'flashcard', 'quiz', 'checkpoint', 'review', 'practice', 'remedial_quiz');--> statement-breakpoint
CREATE TYPE "public"."source_content_type" AS ENUM('page', 'section', 'content');--> statement-breakpoint
CREATE TYPE "public"."source_role" AS ENUM('primary', 'reference', 'supplementary');--> statement-breakpoint
CREATE TYPE "public"."source_status" AS ENUM('pending', 'processing', 'ready', 'failed');--> statement-breakpoint
CREATE TYPE "public"."source_type" AS ENUM('pdf', 'url', 'text');--> statement-breakpoint
CREATE TYPE "public"."xp_reason" AS ENUM('node_completed', 'quiz_completed', 'perfect_score', 'checkpoint_completed', 'adaptive_completed');--> statement-breakpoint
CREATE TABLE "activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"node_id" uuid NOT NULL,
	"type" "activity_type" NOT NULL,
	"position" integer NOT NULL,
	"content" jsonb NOT NULL,
	"evaluation_config" jsonb,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "adaptive_interventions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"module_id" uuid NOT NULL,
	"trigger_node_id" uuid NOT NULL,
	"trigger_attempt_id" uuid NOT NULL,
	"resume_node_id" uuid,
	"reason_code" varchar NOT NULL,
	"reason_summary" text,
	"status" "adaptive_status" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "attempt_concept_results" (
	"attempt_id" uuid NOT NULL,
	"concept_id" uuid NOT NULL,
	"performance_score" numeric NOT NULL,
	CONSTRAINT "attempt_concept_results_attempt_id_concept_id_pk" PRIMARY KEY("attempt_id","concept_id")
);
--> statement-breakpoint
CREATE TABLE "attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"module_id" uuid NOT NULL,
	"node_id" uuid NOT NULL,
	"activity_id" uuid NOT NULL,
	"attempt_number" integer NOT NULL,
	"response" jsonb NOT NULL,
	"score" numeric,
	"max_score" numeric,
	"evaluation" jsonb,
	"ai_feedback" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "generation_request_sources" (
	"generation_request_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"role" "source_role" NOT NULL,
	"priority" smallint NOT NULL,
	"selector" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "generation_request_sources_generation_request_id_source_id_pk" PRIMARY KEY("generation_request_id","source_id")
);
--> statement-breakpoint
CREATE TABLE "generation_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"instruction" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "generation_run_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"generation_run_id" uuid NOT NULL,
	"step" varchar NOT NULL,
	"position" integer NOT NULL,
	"status" "generation_step_status" NOT NULL,
	"metadata" jsonb,
	"error" jsonb,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "generation_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"module_id" uuid NOT NULL,
	"generation_request_id" uuid,
	"adaptive_intervention_id" uuid,
	"type" "generation_type" NOT NULL,
	"bullmq_job_id" varchar,
	"status" "generation_status" NOT NULL,
	"progress_percentage" integer NOT NULL,
	"error" jsonb,
	"metadata" jsonb,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "generation_runs_progress_percentage_check" CHECK ("generation_runs"."progress_percentage" >= 0 AND "generation_runs"."progress_percentage" <= 100)
);
--> statement-breakpoint
CREATE TABLE "module_concepts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"module_id" uuid NOT NULL,
	"key" varchar NOT NULL,
	"name" varchar NOT NULL,
	"description" text,
	"importance" numeric,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "module_nodes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"module_id" uuid NOT NULL,
	"origin" "node_origin" NOT NULL,
	"type" "node_type" NOT NULL,
	"title" varchar NOT NULL,
	"description" text,
	"core_position" integer,
	"adaptive_intervention_id" uuid,
	"adaptive_position" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "module_nodes_origin_integrity_check" CHECK (("module_nodes"."origin" = 'core' AND "module_nodes"."core_position" IS NOT NULL AND "module_nodes"."adaptive_intervention_id" IS NULL AND "module_nodes"."adaptive_position" IS NULL) OR ("module_nodes"."origin" = 'adaptive' AND "module_nodes"."core_position" IS NULL AND "module_nodes"."adaptive_intervention_id" IS NOT NULL AND "module_nodes"."adaptive_position" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "modules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"generation_request_id" uuid NOT NULL,
	"title" varchar NOT NULL,
	"description" text,
	"difficulty" "module_difficulty",
	"status" "module_status" NOT NULL,
	"estimated_minutes" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "node_concepts" (
	"node_id" uuid NOT NULL,
	"concept_id" uuid NOT NULL,
	"relation" "concept_relation" NOT NULL,
	"weight" numeric NOT NULL,
	CONSTRAINT "node_concepts_node_id_concept_id_pk" PRIMARY KEY("node_id","concept_id")
);
--> statement-breakpoint
CREATE TABLE "node_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"node_id" uuid NOT NULL,
	"status" "node_progress_status" NOT NULL,
	"best_score" numeric,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source_contents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"type" "source_content_type" NOT NULL,
	"position" integer NOT NULL,
	"page_number" integer,
	"heading" varchar,
	"content" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "source_type" NOT NULL,
	"title" varchar,
	"storage_key" varchar,
	"original_url" text,
	"text_content" text,
	"mime_type" varchar,
	"original_filename" varchar,
	"content_hash" varchar,
	"status" "source_status" NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_concept_mastery" (
	"user_id" uuid NOT NULL,
	"module_id" uuid NOT NULL,
	"concept_id" uuid NOT NULL,
	"mastery_score" numeric NOT NULL,
	"confidence_score" numeric NOT NULL,
	"evidence_count" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_concept_mastery_user_id_module_id_concept_id_pk" PRIMARY KEY("user_id","module_id","concept_id"),
	CONSTRAINT "user_concept_mastery_mastery_score_check" CHECK ("user_concept_mastery"."mastery_score" >= 0 AND "user_concept_mastery"."mastery_score" <= 1),
	CONSTRAINT "user_concept_mastery_confidence_score_check" CHECK ("user_concept_mastery"."confidence_score" >= 0 AND "user_concept_mastery"."confidence_score" <= 1)
);
--> statement-breakpoint
CREATE TABLE "user_module_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"module_id" uuid NOT NULL,
	"status" "module_progress_status" NOT NULL,
	"current_node_id" uuid,
	"progress_percentage" numeric NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_module_progress_percentage_check" CHECK ("user_module_progress"."progress_percentage" >= 0 AND "user_module_progress"."progress_percentage" <= 100)
);
--> statement-breakpoint
CREATE TABLE "user_stats" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"total_xp" integer DEFAULT 0 NOT NULL,
	"current_streak" integer DEFAULT 0 NOT NULL,
	"longest_streak" integer DEFAULT 0 NOT NULL,
	"last_learning_date" date,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" varchar NOT NULL,
	"display_name" varchar,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "xp_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"module_id" uuid,
	"amount" integer NOT NULL,
	"reason" "xp_reason" NOT NULL,
	"reference_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_node_id_module_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."module_nodes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "adaptive_interventions" ADD CONSTRAINT "adaptive_interventions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "adaptive_interventions" ADD CONSTRAINT "adaptive_interventions_module_id_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "adaptive_interventions" ADD CONSTRAINT "adaptive_interventions_trigger_node_id_module_nodes_id_fk" FOREIGN KEY ("trigger_node_id") REFERENCES "public"."module_nodes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "adaptive_interventions" ADD CONSTRAINT "adaptive_interventions_trigger_attempt_id_attempts_id_fk" FOREIGN KEY ("trigger_attempt_id") REFERENCES "public"."attempts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "adaptive_interventions" ADD CONSTRAINT "adaptive_interventions_resume_node_id_module_nodes_id_fk" FOREIGN KEY ("resume_node_id") REFERENCES "public"."module_nodes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempt_concept_results" ADD CONSTRAINT "attempt_concept_results_attempt_id_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."attempts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempt_concept_results" ADD CONSTRAINT "attempt_concept_results_concept_id_module_concepts_id_fk" FOREIGN KEY ("concept_id") REFERENCES "public"."module_concepts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_module_id_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_node_id_module_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."module_nodes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_activity_id_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_request_sources" ADD CONSTRAINT "generation_request_sources_generation_request_id_generation_requests_id_fk" FOREIGN KEY ("generation_request_id") REFERENCES "public"."generation_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_request_sources" ADD CONSTRAINT "generation_request_sources_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_requests" ADD CONSTRAINT "generation_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_run_steps" ADD CONSTRAINT "generation_run_steps_generation_run_id_generation_runs_id_fk" FOREIGN KEY ("generation_run_id") REFERENCES "public"."generation_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_runs" ADD CONSTRAINT "generation_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_runs" ADD CONSTRAINT "generation_runs_module_id_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_runs" ADD CONSTRAINT "generation_runs_generation_request_id_generation_requests_id_fk" FOREIGN KEY ("generation_request_id") REFERENCES "public"."generation_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_runs" ADD CONSTRAINT "generation_runs_adaptive_intervention_id_adaptive_interventions_id_fk" FOREIGN KEY ("adaptive_intervention_id") REFERENCES "public"."adaptive_interventions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "module_concepts" ADD CONSTRAINT "module_concepts_module_id_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "module_nodes" ADD CONSTRAINT "module_nodes_module_id_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "module_nodes" ADD CONSTRAINT "module_nodes_adaptive_intervention_id_adaptive_interventions_id_fk" FOREIGN KEY ("adaptive_intervention_id") REFERENCES "public"."adaptive_interventions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modules" ADD CONSTRAINT "modules_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modules" ADD CONSTRAINT "modules_generation_request_id_generation_requests_id_fk" FOREIGN KEY ("generation_request_id") REFERENCES "public"."generation_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "node_concepts" ADD CONSTRAINT "node_concepts_node_id_module_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."module_nodes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "node_concepts" ADD CONSTRAINT "node_concepts_concept_id_module_concepts_id_fk" FOREIGN KEY ("concept_id") REFERENCES "public"."module_concepts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "node_progress" ADD CONSTRAINT "node_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "node_progress" ADD CONSTRAINT "node_progress_node_id_module_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."module_nodes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_contents" ADD CONSTRAINT "source_contents_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sources" ADD CONSTRAINT "sources_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_concept_mastery" ADD CONSTRAINT "user_concept_mastery_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_concept_mastery" ADD CONSTRAINT "user_concept_mastery_module_id_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_concept_mastery" ADD CONSTRAINT "user_concept_mastery_concept_id_module_concepts_id_fk" FOREIGN KEY ("concept_id") REFERENCES "public"."module_concepts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_module_progress" ADD CONSTRAINT "user_module_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_module_progress" ADD CONSTRAINT "user_module_progress_module_id_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_module_progress" ADD CONSTRAINT "user_module_progress_current_node_id_module_nodes_id_fk" FOREIGN KEY ("current_node_id") REFERENCES "public"."module_nodes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_stats" ADD CONSTRAINT "user_stats_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xp_events" ADD CONSTRAINT "xp_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xp_events" ADD CONSTRAINT "xp_events_module_id_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activities_node_position_idx" ON "activities" USING btree ("node_id","position");--> statement-breakpoint
CREATE INDEX "adaptive_interventions_user_module_idx" ON "adaptive_interventions" USING btree ("user_id","module_id");--> statement-breakpoint
CREATE INDEX "adaptive_interventions_status_idx" ON "adaptive_interventions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "attempts_user_module_idx" ON "attempts" USING btree ("user_id","module_id");--> statement-breakpoint
CREATE INDEX "attempts_activity_idx" ON "attempts" USING btree ("activity_id");--> statement-breakpoint
CREATE INDEX "attempts_node_idx" ON "attempts" USING btree ("node_id");--> statement-breakpoint
CREATE INDEX "generation_request_sources_source_id_idx" ON "generation_request_sources" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "generation_requests_user_id_idx" ON "generation_requests" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "generation_run_steps_run_position_idx" ON "generation_run_steps" USING btree ("generation_run_id","position");--> statement-breakpoint
CREATE INDEX "generation_runs_module_idx" ON "generation_runs" USING btree ("module_id");--> statement-breakpoint
CREATE INDEX "generation_runs_status_idx" ON "generation_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "generation_runs_bullmq_job_idx" ON "generation_runs" USING btree ("bullmq_job_id");--> statement-breakpoint
CREATE UNIQUE INDEX "module_concepts_module_key_idx" ON "module_concepts" USING btree ("module_id","key");--> statement-breakpoint
CREATE INDEX "module_nodes_module_origin_idx" ON "module_nodes" USING btree ("module_id","origin");--> statement-breakpoint
CREATE INDEX "module_nodes_core_position_idx" ON "module_nodes" USING btree ("module_id","core_position");--> statement-breakpoint
CREATE INDEX "module_nodes_adaptive_intervention_idx" ON "module_nodes" USING btree ("adaptive_intervention_id");--> statement-breakpoint
CREATE INDEX "modules_owner_id_idx" ON "modules" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "modules_status_idx" ON "modules" USING btree ("status");--> statement-breakpoint
CREATE INDEX "modules_generation_request_idx" ON "modules" USING btree ("generation_request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "node_progress_user_node_idx" ON "node_progress" USING btree ("user_id","node_id");--> statement-breakpoint
CREATE INDEX "source_contents_source_position_idx" ON "source_contents" USING btree ("source_id","position");--> statement-breakpoint
CREATE INDEX "source_contents_source_page_idx" ON "source_contents" USING btree ("source_id","page_number");--> statement-breakpoint
CREATE INDEX "sources_user_id_idx" ON "sources" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sources_status_idx" ON "sources" USING btree ("status");--> statement-breakpoint
CREATE INDEX "sources_content_hash_idx" ON "sources" USING btree ("content_hash");--> statement-breakpoint
CREATE INDEX "user_concept_mastery_module_idx" ON "user_concept_mastery" USING btree ("user_id","module_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_module_progress_user_module_idx" ON "user_module_progress" USING btree ("user_id","module_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_clerk_user_id_idx" ON "users" USING btree ("clerk_user_id");--> statement-breakpoint
CREATE INDEX "xp_events_user_created_idx" ON "xp_events" USING btree ("user_id","created_at" DESC NULLS LAST);