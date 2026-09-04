CREATE TYPE "public"."source_processing_status" AS ENUM('queued', 'processing', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "source_processing_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"bullmq_job_id" varchar,
	"status" "source_processing_status" NOT NULL,
	"error" jsonb,
	"metadata" jsonb,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "source_contents_source_position_idx";--> statement-breakpoint
ALTER TABLE "sources" ADD COLUMN "failure" jsonb;--> statement-breakpoint
ALTER TABLE "source_processing_runs" ADD CONSTRAINT "source_processing_runs_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "source_processing_runs_source_idx" ON "source_processing_runs" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "source_processing_runs_status_created_idx" ON "source_processing_runs" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "source_processing_runs_bullmq_job_idx" ON "source_processing_runs" USING btree ("bullmq_job_id") WHERE "source_processing_runs"."bullmq_job_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "source_processing_runs_active_source_idx" ON "source_processing_runs" USING btree ("source_id") WHERE "source_processing_runs"."status" IN ('queued', 'processing');--> statement-breakpoint
CREATE UNIQUE INDEX "source_contents_source_position_idx" ON "source_contents" USING btree ("source_id","position");--> statement-breakpoint
ALTER TABLE "source_contents" ADD CONSTRAINT "source_contents_position_check" CHECK ("source_contents"."position" > 0);--> statement-breakpoint
ALTER TABLE "source_contents" ADD CONSTRAINT "source_contents_page_number_check" CHECK ("source_contents"."page_number" IS NULL OR "source_contents"."page_number" > 0);