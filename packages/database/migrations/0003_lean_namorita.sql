DROP INDEX "activities_node_position_idx";--> statement-breakpoint
DROP INDEX "generation_run_steps_run_position_idx";--> statement-breakpoint
DROP INDEX "generation_runs_bullmq_job_idx";--> statement-breakpoint
DROP INDEX "module_nodes_core_position_idx";--> statement-breakpoint
DROP INDEX "modules_generation_request_idx";--> statement-breakpoint
ALTER TABLE "modules" ALTER COLUMN "title" DROP NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "generation_request_sources_request_priority_idx" ON "generation_request_sources" USING btree ("generation_request_id","priority");--> statement-breakpoint
CREATE UNIQUE INDEX "activities_node_position_idx" ON "activities" USING btree ("node_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "generation_run_steps_run_position_idx" ON "generation_run_steps" USING btree ("generation_run_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "generation_runs_bullmq_job_idx" ON "generation_runs" USING btree ("bullmq_job_id") WHERE "generation_runs"."bullmq_job_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "module_nodes_core_position_idx" ON "module_nodes" USING btree ("module_id","core_position") WHERE "module_nodes"."core_position" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "modules_generation_request_idx" ON "modules" USING btree ("generation_request_id");--> statement-breakpoint
ALTER TABLE "modules" ADD CONSTRAINT "modules_ready_title_check" CHECK ("modules"."status" NOT IN ('ready', 'archived') OR "modules"."title" IS NOT NULL);