import {
  Inject,
  Injectable,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from "@nestjs/common";
import { type AdaptiveGenerationJob, adaptiveGenerationJobSchema } from "@ngertiin/contracts/jobs";
import { QUEUE_NAMES } from "@ngertiin/shared";
import { Worker as BullWorker, type Job, UnrecoverableError } from "bullmq";
import { AiService } from "../ai/ai.service.js";
import { InfrastructureService } from "../infrastructure/infrastructure.service.js";
import { generationLanguageRule } from "../modules/generation-settings.js";
import { LessonImagesService } from "../modules/lesson-images.service.js";
import {
  checkpointActivitiesSchemaFor,
  type NodeActivities,
  nodeActivitiesSchemaFor,
} from "../modules/modules.schemas.js";
import { TEACHING_STYLE } from "../modules/teaching-style.js";
import { adaptiveCheckpointSchema, adaptivePlanSchema } from "./adaptive.schemas.js";
import { AdaptiveService } from "./adaptive.service.js";

@Injectable()
export class AdaptiveProcessor implements OnApplicationBootstrap, OnApplicationShutdown {
  private worker?: BullWorker<AdaptiveGenerationJob>;
  constructor(
    @Inject(InfrastructureService) private readonly infrastructure: InfrastructureService,
    @Inject(AdaptiveService) private readonly adaptive: AdaptiveService,
    @Inject(LessonImagesService) private readonly lessonImages: LessonImagesService,
    @Inject(AiService) private readonly ai: AiService,
  ) {}
  onApplicationBootstrap(): void {
    this.worker = new BullWorker(QUEUE_NAMES.adaptiveGeneration, (job) => this.process(job), {
      connection: this.infrastructure.redis,
      concurrency: 1,
    });
    this.worker.on("error", (error) =>
      console.error(
        JSON.stringify({ level: "error", event: "adaptive.worker_error", errorType: error.name }),
      ),
    );
    this.worker.on("completed", (job) => {
      console.log(
        JSON.stringify({
          level: "log",
          event: "adaptive.job_completed",
          runId: job.data.generationRunId,
          moduleId: job.data.moduleId,
          interventionId: job.data.adaptiveInterventionId,
          jobId: job.id,
          attemptNumber: job.attemptsMade,
          latencyMs:
            job.processedOn && job.finishedOn
              ? Math.max(0, job.finishedOn - job.processedOn)
              : null,
          validationOutcome: "passed",
        }),
      );
    });
    this.worker.on("failed", (job, error) => {
      console.error(
        JSON.stringify({
          level: "error",
          event: "adaptive.job_attempt_failed",
          runId: job?.data.generationRunId,
          moduleId: job?.data.moduleId,
          interventionId: job?.data.adaptiveInterventionId,
          jobId: job?.id,
          attemptNumber: job?.attemptsMade,
          latencyMs:
            job?.processedOn && job.finishedOn
              ? Math.max(0, job.finishedOn - job.processedOn)
              : null,
          failureCategory: error.name === "UnrecoverableError" ? "terminal" : "retryable",
        }),
      );
    });
  }
  async onApplicationShutdown(): Promise<void> {
    await this.worker?.close();
  }

  private async process(job: Job<AdaptiveGenerationJob>): Promise<void> {
    const payload = adaptiveGenerationJobSchema.parse(job.data);
    console.log(
      JSON.stringify({
        level: "log",
        event: "adaptive.job_started",
        runId: payload.generationRunId,
        moduleId: payload.moduleId,
        interventionId: payload.adaptiveInterventionId,
        jobId: job.id,
        attemptNumber: job.attemptsMade + 1,
      }),
    );
    await this.adaptive.withRunLock(payload.generationRunId, async () => {
      try {
        const context = await this.adaptive.start(payload);
        if (!context) return;
        await this.adaptive.begin(payload.generationRunId, "analyze_weak_concepts");
        await this.adaptive.complete(payload.generationRunId, "analyze_weak_concepts", {
          conceptCount: context.concepts.length,
        });
        await this.adaptive.begin(payload.generationRunId, "plan_remediation");
        const checkpoint = adaptiveCheckpointSchema.safeParse(
          await this.adaptive.readCheckpoint(payload.generationRunId),
        );
        const plan = checkpoint.success
          ? checkpoint.data.plan
          : await this.ai.generateObject({
              schema: adaptivePlanSchema,
              schemaName: "adaptive_plan",
              operation: "plan_remediation",
              prompt: [
                generationLanguageRule(context.generationSettings),
                "Create a focused remediation plan of one to three nodes.",
                "Use only the supplied target concept keys. Do not create or modify core nodes.",
                "Allowed node types: review, practice, flashcard, remedial_quiz.",
                `TARGET CONCEPTS:\n${JSON.stringify(context.concepts)}`,
                `RELEVANT CORE CONTENT:\n${JSON.stringify(context.coreContent)}`,
              ].join("\n\n"),
            });
        await this.adaptive.complete(payload.generationRunId, "plan_remediation", {
          nodeCount: plan.nodes.length,
        });
        await this.adaptive.begin(payload.generationRunId, "generate_adaptive_activities");
        const generated: NodeActivities[] = [];
        for (const [nodeIndex, node] of plan.nodes.entries()) {
          const schemaType =
            node.type === "flashcard" ? "flashcard" : node.type === "review" ? "lesson" : "quiz";
          const cached = checkpoint.success ? checkpoint.data.generated[nodeIndex] : undefined;
          if (cached !== undefined) {
            generated.push(checkpointActivitiesSchemaFor(schemaType).parse(cached));
            continue;
          }
          const output = await this.ai.generateObject({
            schema: nodeActivitiesSchemaFor(schemaType),
            schemaName: "adaptive_node_activities",
            operation: "generate_adaptive_activities",
            prompt: [
              generationLanguageRule(context.generationSettings),
              TEACHING_STYLE,
              "Generate focused remediation activities for this adaptive node.",
              "Use only supplied concept keys and existing core content. Put answer keys only in evaluationConfig.",
              `NODE:\n${JSON.stringify(node)}`,
              `TARGET CONCEPTS:\n${JSON.stringify(context.concepts)}`,
              `RELEVANT CORE CONTENT:\n${JSON.stringify(context.coreContent)}`,
            ].join("\n\n"),
          });
          generated.push(
            await this.lessonImages.enrich(output, payload.generationRunId, String(nodeIndex)),
          );
          await this.adaptive.saveCheckpoint(payload.generationRunId, plan, generated);
        }
        await this.adaptive.complete(payload.generationRunId, "generate_adaptive_activities", {
          nodeCount: generated.length,
          plan,
          generated,
        });
        await this.adaptive.begin(payload.generationRunId, "validate_adaptive_content");
        await this.adaptive.finalize(payload, context, plan, generated);
      } catch (error) {
        if (job.attemptsMade + 1 < (job.opts.attempts ?? 1)) throw error;
        await this.adaptive.fail(payload);
        throw new UnrecoverableError("GENERATION_FAILED");
      }
    });
  }
}
