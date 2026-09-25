CREATE TYPE "public"."practice_attempt_status" AS ENUM('active', 'evaluating', 'completed', 'evaluation_failed');--> statement-breakpoint
CREATE TYPE "public"."practice_generation_status" AS ENUM('queued', 'processing', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."practice_kind" AS ENUM('flashcard', 'quiz', 'exam');--> statement-breakpoint
CREATE TYPE "public"."practice_status" AS ENUM('generating', 'ready', 'failed');--> statement-breakpoint
ALTER TYPE "public"."xp_reason" ADD VALUE 'practice_completed';--> statement-breakpoint
CREATE TABLE "chat_interactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"assistant_message_id" uuid,
	"kind" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"interrupt_json" jsonb NOT NULL,
	"public_json" jsonb NOT NULL,
	"decision_json" jsonb,
	"response_id" uuid,
	"revision" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone,
	CONSTRAINT "chat_interactions_kind_check" CHECK ("chat_interactions"."kind" in ('ask_user','create_practice')),
	CONSTRAINT "chat_interactions_status_check" CHECK ("chat_interactions"."status" in ('pending','answered','approved','rejected','revising','cancelled'))
);--> statement-breakpoint
CREATE TABLE "practice_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"practice_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "practice_attempt_status" DEFAULT 'active' NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"results" jsonb,
	"score" numeric,
	"xp_awarded" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deadline_at" timestamp with time zone,
	"submitted_at" timestamp with time zone,
	"evaluated_at" timestamp with time zone,
	"failure" jsonb,
	CONSTRAINT "practice_attempts_revision_check" CHECK ("practice_attempts"."revision" >= 0),
	CONSTRAINT "practice_attempts_xp_check" CHECK ("practice_attempts"."xp_awarded" >= 0)
);--> statement-breakpoint
CREATE TABLE "practice_generation_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"practice_id" uuid NOT NULL,
	"status" "practice_generation_status" DEFAULT 'queued' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"bullmq_job_id" text,
	"batches_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"failure" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	CONSTRAINT "practice_generation_attempt_check" CHECK ("practice_generation_runs"."attempt_count" between 0 and 3),
	CONSTRAINT "practice_generation_progress_check" CHECK ("practice_generation_runs"."progress" between 0 and 100)
);--> statement-breakpoint
CREATE TABLE "practice_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"practice_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"content" jsonb NOT NULL,
	"private_key" jsonb NOT NULL,
	"source_refs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "practice_items_position_check" CHECK ("practice_items"."position" > 0)
);--> statement-breakpoint
CREATE TABLE "practice_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"module_id" uuid NOT NULL,
	"kind" "practice_kind" NOT NULL,
	"status" "practice_status" DEFAULT 'generating' NOT NULL,
	"title" text NOT NULL,
	"configuration" jsonb NOT NULL,
	"approved_interaction_id" uuid,
	"approval_action_id" uuid NOT NULL,
	"variation_of_id" uuid,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "practice_sets_title_check" CHECK (char_length("practice_sets"."title") between 1 and 120)
);--> statement-breakpoint
CREATE TABLE "practice_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"practice_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"origin" text NOT NULL,
	"module_id" uuid,
	"source_id" uuid,
	"source_content_id" uuid,
	"attachment_id" uuid,
	"content_revision" text,
	"snapshot_text" text NOT NULL,
	"object_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "practice_sources_position_check" CHECK ("practice_sources"."position" > 0),
	CONSTRAINT "practice_sources_origin_check" CHECK ("practice_sources"."origin" in ('module','attachment'))
);--> statement-breakpoint
DROP INDEX "chat_one_active_run_per_thread";--> statement-breakpoint
ALTER TABLE "chat_runs" ADD COLUMN "model_calls" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "chat_runs" ADD COLUMN "tool_calls" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "chat_runs" ADD COLUMN "paused_remaining_ms" integer;--> statement-breakpoint
ALTER TABLE "chat_interactions" ADD CONSTRAINT "chat_interactions_run_id_chat_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."chat_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_interactions" ADD CONSTRAINT "chat_interactions_assistant_message_id_chat_messages_id_fk" FOREIGN KEY ("assistant_message_id") REFERENCES "public"."chat_messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practice_attempts" ADD CONSTRAINT "practice_attempts_practice_id_practice_sets_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practice_sets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practice_attempts" ADD CONSTRAINT "practice_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practice_generation_runs" ADD CONSTRAINT "practice_generation_runs_practice_id_practice_sets_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practice_sets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practice_items" ADD CONSTRAINT "practice_items_practice_id_practice_sets_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practice_sets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practice_sets" ADD CONSTRAINT "practice_sets_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practice_sets" ADD CONSTRAINT "practice_sets_module_id_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practice_sets" ADD CONSTRAINT "practice_sets_approved_interaction_id_chat_interactions_id_fk" FOREIGN KEY ("approved_interaction_id") REFERENCES "public"."chat_interactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practice_sets" ADD CONSTRAINT "practice_sets_variation_of_id_practice_sets_id_fk" FOREIGN KEY ("variation_of_id") REFERENCES "public"."practice_sets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practice_sources" ADD CONSTRAINT "practice_sources_practice_id_practice_sets_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practice_sets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practice_sources" ADD CONSTRAINT "practice_sources_module_id_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practice_sources" ADD CONSTRAINT "practice_sources_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practice_sources" ADD CONSTRAINT "practice_sources_source_content_id_source_contents_id_fk" FOREIGN KEY ("source_content_id") REFERENCES "public"."source_contents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practice_sources" ADD CONSTRAINT "practice_sources_attachment_id_chat_attachments_id_fk" FOREIGN KEY ("attachment_id") REFERENCES "public"."chat_attachments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_interactions_run_idx" ON "chat_interactions" USING btree ("run_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "chat_interactions_response_idx" ON "chat_interactions" USING btree ("response_id");--> statement-breakpoint
CREATE INDEX "practice_attempts_user_set_idx" ON "practice_attempts" USING btree ("user_id","practice_id","started_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "practice_attempts_deadline_idx" ON "practice_attempts" USING btree ("status","deadline_at");--> statement-breakpoint
CREATE UNIQUE INDEX "practice_attempts_one_active_idx" ON "practice_attempts" USING btree ("user_id","practice_id") WHERE "practice_attempts"."status" = 'active';--> statement-breakpoint
CREATE INDEX "practice_generation_dispatch_idx" ON "practice_generation_runs" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "practice_items_position_idx" ON "practice_items" USING btree ("practice_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "practice_sets_approval_action_idx" ON "practice_sets" USING btree ("approval_action_id");--> statement-breakpoint
CREATE INDEX "practice_sets_module_list_idx" ON "practice_sets" USING btree ("owner_id","module_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "practice_sources_position_idx" ON "practice_sources" USING btree ("practice_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "chat_one_active_run_per_thread" ON "chat_runs" USING btree ("thread_id") WHERE "chat_runs"."status" not in ('completed', 'failed', 'cancelled', 'timed_out', 'interrupted');
