ALTER TYPE "public"."adaptive_status" ADD VALUE 'offered' BEFORE 'generating';--> statement-breakpoint
CREATE TABLE "adaptive_intervention_concepts" (
	"adaptive_intervention_id" uuid NOT NULL,
	"concept_id" uuid NOT NULL,
	"mastery_score" numeric NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "adaptive_intervention_concepts_adaptive_intervention_id_concept_id_pk" PRIMARY KEY("adaptive_intervention_id","concept_id"),
	CONSTRAINT "adaptive_intervention_concepts_mastery_score_check" CHECK ("adaptive_intervention_concepts"."mastery_score" >= 0 AND "adaptive_intervention_concepts"."mastery_score" <= 1)
);
--> statement-breakpoint
ALTER TABLE "adaptive_interventions" ADD COLUMN "required" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "adaptive_intervention_concepts" ADD CONSTRAINT "adaptive_intervention_concepts_adaptive_intervention_id_adaptive_interventions_id_fk" FOREIGN KEY ("adaptive_intervention_id") REFERENCES "public"."adaptive_interventions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "adaptive_intervention_concepts" ADD CONSTRAINT "adaptive_intervention_concepts_concept_id_module_concepts_id_fk" FOREIGN KEY ("concept_id") REFERENCES "public"."module_concepts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "adaptive_intervention_concepts_concept_idx" ON "adaptive_intervention_concepts" USING btree ("concept_id");--> statement-breakpoint
CREATE UNIQUE INDEX "adaptive_interventions_trigger_attempt_idx" ON "adaptive_interventions" USING btree ("trigger_attempt_id");--> statement-breakpoint
CREATE UNIQUE INDEX "generation_runs_adaptive_intervention_idx" ON "generation_runs" USING btree ("adaptive_intervention_id") WHERE "generation_runs"."adaptive_intervention_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "module_nodes_adaptive_position_idx" ON "module_nodes" USING btree ("adaptive_intervention_id","adaptive_position") WHERE "module_nodes"."adaptive_intervention_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "generation_runs" ADD CONSTRAINT "generation_runs_type_integrity_check" CHECK (("generation_runs"."type" = 'module' AND "generation_runs"."generation_request_id" IS NOT NULL AND "generation_runs"."adaptive_intervention_id" IS NULL) OR ("generation_runs"."type" = 'adaptive' AND "generation_runs"."generation_request_id" IS NULL AND "generation_runs"."adaptive_intervention_id" IS NOT NULL));