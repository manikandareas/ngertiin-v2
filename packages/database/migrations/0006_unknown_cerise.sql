DO $$
BEGIN
	IF EXISTS (SELECT 1 FROM "attempts" LIMIT 1) THEN
		RAISE EXCEPTION 'M5 migration requires an empty attempts table; remove development-only Attempt data before retrying';
	END IF;
END
$$;--> statement-breakpoint
CREATE TYPE "public"."attempt_evaluation_status" AS ENUM('evaluating', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."attempt_policy_outcome" AS ENUM('continue', 'optional_review', 'required_intervention');--> statement-breakpoint
CREATE TABLE "attempt_responses" (
	"attempt_id" uuid NOT NULL,
	"activity_id" uuid NOT NULL,
	"response" jsonb NOT NULL,
	"score" numeric,
	"max_score" numeric,
	"evaluation" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "attempt_responses_attempt_id_activity_id_pk" PRIMARY KEY("attempt_id","activity_id"),
	CONSTRAINT "attempt_responses_score_check" CHECK ("attempt_responses"."score" IS NULL OR ("attempt_responses"."score" >= 0 AND "attempt_responses"."max_score" IS NOT NULL AND "attempt_responses"."score" <= "attempt_responses"."max_score")),
	CONSTRAINT "attempt_responses_max_score_check" CHECK ("attempt_responses"."max_score" IS NULL OR "attempt_responses"."max_score" > 0)
);
--> statement-breakpoint
ALTER TABLE "attempts" DROP CONSTRAINT "attempts_activity_id_activities_id_fk";
--> statement-breakpoint
DROP INDEX "attempts_activity_idx";--> statement-breakpoint
ALTER TABLE "attempt_concept_results" ADD COLUMN "mastery_score" numeric NOT NULL;--> statement-breakpoint
ALTER TABLE "attempt_concept_results" ADD COLUMN "confidence_score" numeric NOT NULL;--> statement-breakpoint
ALTER TABLE "attempt_concept_results" ADD COLUMN "evidence_count" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "submission_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "submission_hash" varchar(64) NOT NULL;--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "evaluation_status" "attempt_evaluation_status" NOT NULL;--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "policy_outcome" "attempt_policy_outcome";--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "xp_awarded" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "failure" jsonb;--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "evaluated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "attempt_responses" ADD CONSTRAINT "attempt_responses_attempt_id_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."attempts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempt_responses" ADD CONSTRAINT "attempt_responses_activity_id_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attempt_responses_activity_idx" ON "attempt_responses" USING btree ("activity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "attempts_user_submission_idx" ON "attempts" USING btree ("user_id","submission_id");--> statement-breakpoint
CREATE UNIQUE INDEX "attempts_user_node_number_idx" ON "attempts" USING btree ("user_id","node_id","attempt_number");--> statement-breakpoint
ALTER TABLE "attempts" DROP COLUMN "activity_id";--> statement-breakpoint
ALTER TABLE "attempts" DROP COLUMN "response";--> statement-breakpoint
ALTER TABLE "attempts" DROP COLUMN "evaluation";--> statement-breakpoint
ALTER TABLE "attempts" DROP COLUMN "ai_feedback";--> statement-breakpoint
ALTER TABLE "attempt_concept_results" ADD CONSTRAINT "attempt_concept_results_performance_score_check" CHECK ("attempt_concept_results"."performance_score" >= 0 AND "attempt_concept_results"."performance_score" <= 1);--> statement-breakpoint
ALTER TABLE "attempt_concept_results" ADD CONSTRAINT "attempt_concept_results_mastery_score_check" CHECK ("attempt_concept_results"."mastery_score" >= 0 AND "attempt_concept_results"."mastery_score" <= 1);--> statement-breakpoint
ALTER TABLE "attempt_concept_results" ADD CONSTRAINT "attempt_concept_results_confidence_score_check" CHECK ("attempt_concept_results"."confidence_score" >= 0 AND "attempt_concept_results"."confidence_score" <= 1);--> statement-breakpoint
ALTER TABLE "attempt_concept_results" ADD CONSTRAINT "attempt_concept_results_evidence_count_check" CHECK ("attempt_concept_results"."evidence_count" > 0);--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_attempt_number_check" CHECK ("attempts"."attempt_number" > 0);--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_score_check" CHECK ("attempts"."score" IS NULL OR ("attempts"."score" >= 0 AND "attempts"."max_score" IS NOT NULL AND "attempts"."score" <= "attempts"."max_score"));--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_max_score_check" CHECK ("attempts"."max_score" IS NULL OR "attempts"."max_score" > 0);--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_xp_awarded_check" CHECK ("attempts"."xp_awarded" >= 0);--> statement-breakpoint
ALTER TABLE "node_progress" ADD CONSTRAINT "node_progress_best_score_check" CHECK ("node_progress"."best_score" IS NULL OR ("node_progress"."best_score" >= 0 AND "node_progress"."best_score" <= 1));--> statement-breakpoint
ALTER TABLE "node_progress" ADD CONSTRAINT "node_progress_attempt_count_check" CHECK ("node_progress"."attempt_count" >= 0);--> statement-breakpoint
ALTER TABLE "user_concept_mastery" ADD CONSTRAINT "user_concept_mastery_evidence_count_check" CHECK ("user_concept_mastery"."evidence_count" > 0);
