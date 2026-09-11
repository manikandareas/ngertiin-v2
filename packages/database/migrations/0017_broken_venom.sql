CREATE TYPE "public"."chat_run_status" AS ENUM('queued', 'running', 'cancelling', 'completed', 'failed', 'cancelled', 'timed_out', 'interrupted');--> statement-breakpoint
CREATE TABLE "chat_message_contexts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"reference_json" jsonb NOT NULL,
	"snapshot_text" text,
	"content_revision" text,
	"dependency_only" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thread_id" uuid NOT NULL,
	"run_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"role" text NOT NULL,
	"parts_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"content_revision" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chat_messages_role_check" CHECK ("chat_messages"."role" in ('user','assistant')),
	CONSTRAINT "chat_messages_sequence_positive" CHECK ("chat_messages"."sequence" > 0)
);
--> statement-breakpoint
CREATE TABLE "chat_run_usage" (
	"run_id" uuid NOT NULL,
	"call_id" text NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"input_tokens" integer,
	"output_tokens" integer,
	"total_tokens" integer,
	"coverage" text NOT NULL,
	CONSTRAINT "chat_run_usage_run_id_call_id_pk" PRIMARY KEY("run_id","call_id")
);
--> statement-breakpoint
CREATE TABLE "chat_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thread_id" uuid NOT NULL,
	"user_message_id" uuid,
	"assistant_message_id" uuid,
	"retry_of_run_id" uuid,
	"status" "chat_run_status" DEFAULT 'queued' NOT NULL,
	"error_code" text,
	"executor_id" uuid,
	"lease_epoch" integer DEFAULT 0 NOT NULL,
	"lease_expires_at" timestamp with time zone,
	"heartbeat_at" timestamp with time zone,
	"cancel_requested_at" timestamp with time zone,
	"deadline_at" timestamp with time zone NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"snapshot_sequence" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_threads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"module_id" uuid NOT NULL,
	"title" text DEFAULT 'Percakapan baru' NOT NULL,
	"next_sequence" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "chat_thread_title_length" CHECK (char_length("chat_threads"."title") between 1 and 120)
);
--> statement-breakpoint
ALTER TABLE "chat_message_contexts" ADD CONSTRAINT "chat_message_contexts_message_id_chat_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."chat_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_thread_id_chat_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."chat_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_run_id_chat_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."chat_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_run_usage" ADD CONSTRAINT "chat_run_usage_run_id_chat_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."chat_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_runs" ADD CONSTRAINT "chat_runs_thread_id_chat_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."chat_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_runs" ADD CONSTRAINT "chat_runs_user_message_id_chat_messages_id_fk" FOREIGN KEY ("user_message_id") REFERENCES "public"."chat_messages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_runs" ADD CONSTRAINT "chat_runs_assistant_message_id_chat_messages_id_fk" FOREIGN KEY ("assistant_message_id") REFERENCES "public"."chat_messages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_runs" ADD CONSTRAINT "chat_runs_retry_of_run_id_chat_runs_id_fk" FOREIGN KEY ("retry_of_run_id") REFERENCES "public"."chat_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_threads" ADD CONSTRAINT "chat_threads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_threads" ADD CONSTRAINT "chat_threads_module_id_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_context_message_idx" ON "chat_message_contexts" USING btree ("message_id");--> statement-breakpoint
CREATE UNIQUE INDEX "chat_messages_sequence_unique" ON "chat_messages" USING btree ("thread_id","sequence");--> statement-breakpoint
CREATE UNIQUE INDEX "chat_messages_run_role_unique" ON "chat_messages" USING btree ("run_id","role");--> statement-breakpoint
CREATE UNIQUE INDEX "chat_one_active_run_per_thread" ON "chat_runs" USING btree ("thread_id") WHERE "chat_runs"."status" in ('queued', 'running', 'cancelling');--> statement-breakpoint
CREATE INDEX "chat_runs_lease_idx" ON "chat_runs" USING btree ("status","lease_expires_at");--> statement-breakpoint
CREATE INDEX "chat_runs_queue_idx" ON "chat_runs" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "chat_threads_owner_page_idx" ON "chat_threads" USING btree ("user_id","module_id","created_at","id");