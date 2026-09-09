import {
  Inject,
  Injectable,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from "@nestjs/common";
import {
  ADAPTIVE_MAX_ATTEMPTS,
  ADAPTIVE_RETRY_DELAY_MS,
  type AdaptiveGenerationJob,
  type AdaptiveGenerationStep,
  adaptiveGenerationJobSchema,
} from "@ngertiin/contracts/jobs";
import { QUEUE_NAMES } from "@ngertiin/shared";
import { Worker as BullWorker, type Job, UnrecoverableError } from "bullmq";
import { AiService } from "../ai/ai.service.js";
import { InfrastructureService } from "../infrastructure/infrastructure.service.js";
import { generationLanguageRule } from "../modules/generation-settings.js";
import { LessonImagesService } from "../modules/lesson-images.service.js";
import { type NodeActivities, nodeActivitiesSchemaFor } from "../modules/modules.schemas.js";
import { TEACHING_STYLE } from "../modules/teaching-style.js";
import { adaptiveCheckpointSchema, adaptivePlanSchema } from "./adaptive.schemas.js";
import { AdaptiveService } from "./adaptive.service.js";
import {
  AdaptiveContentError,
  adaptiveErrorDetails,
  adaptiveFailure,
  adaptiveNodeSchemaType,
  parseAdaptiveActivities,
  parseGeneratedAdaptiveActivities,
  validateAdaptivePlan,
} from "./adaptive-content.js";

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
        JSON.stringify({
          level: "error",
          event: "adaptive.worker_error",
          ...adaptiveErrorDetails(error),
        }),
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
          event: "adaptive.job_failed",
          runId: job?.data.generationRunId,
          moduleId: job?.data.moduleId,
          interventionId: job?.data.adaptiveInterventionId,
          jobId: job?.id,
          attemptNumber: job?.attemptsMade,
          latencyMs:
            job?.processedOn && job.finishedOn
              ? Math.max(0, job.finishedOn - job.processedOn)
              : null,
          failureCategory:
            error.name === "UnrecoverableError" ||
            (job?.attemptsMade ?? 0) >= (job?.opts.attempts ?? 1)
              ? "terminal"
              : "retryable",
          ...adaptiveErrorDetails(error),
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
    const startedAt = performance.now();
    let step: AdaptiveGenerationStep | "start" = "start";
    let attemptNumber = job.attemptsMade + 1;
    await this.adaptive.withRunLock(payload.generationRunId, async () => {
      try {
        const context = await this.adaptive.start(payload, job.id);
        if (!context) return;
        attemptNumber = context.attemptNumber;
        if (attemptNumber > ADAPTIVE_MAX_ATTEMPTS) throw new Error("Adaptive attempts exhausted.");
        step = "analyze_weak_concepts";
        await this.adaptive.begin(payload.generationRunId, "analyze_weak_concepts");
        await this.adaptive.complete(payload.generationRunId, "analyze_weak_concepts", {
          conceptCount: context.concepts.length,
        });
        step = "plan_remediation";
        await this.adaptive.begin(payload.generationRunId, step);
        let checkpoint = adaptiveCheckpointSchema.safeParse(
          await this.adaptive.readCheckpoint(payload.generationRunId),
        );
        if (checkpoint.success) {
          try {
            validateAdaptivePlan(
              checkpoint.data.plan,
              context.concepts.map((concept) => concept.key),
            );
          } catch (error) {
            console.warn(
              JSON.stringify({
                level: "warn",
                event: "adaptive.checkpoint_invalidated",
                runId: payload.generationRunId,
                step,
                ...adaptiveErrorDetails(error),
              }),
            );
            checkpoint = adaptiveCheckpointSchema.safeParse(null);
          }
        }
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
        validateAdaptivePlan(
          plan,
          context.concepts.map((concept) => concept.key),
        );
        await this.adaptive.complete(payload.generationRunId, "plan_remediation", {
          nodeCount: plan.nodes.length,
        });
        step = "generate_adaptive_activities";
        await this.adaptive.begin(payload.generationRunId, step);
        const cachedNodes = checkpoint.success ? checkpoint.data.generated : [];
        const generated: Array<NodeActivities | null> = plan.nodes.map((node, index) => {
          if (cachedNodes[index] == null) return null;
          try {
            return parseAdaptiveActivities(node, cachedNodes[index], index);
          } catch (error) {
            console.warn(
              JSON.stringify({
                level: "warn",
                event: "adaptive.checkpoint_invalidated",
                runId: payload.generationRunId,
                step,
                ...adaptiveErrorDetails(error),
              }),
            );
            return null;
          }
        });
        // Persist holes before calling the provider so an invalid node cannot poison future retries.
        // Valid later nodes stay reusable even when an earlier node must be regenerated.
        await this.adaptive.saveCheckpoint(payload.generationRunId, plan, generated);
        for (const [nodeIndex, node] of plan.nodes.entries()) {
          if (generated[nodeIndex]) continue;
          const output = await this.ai.generateObject({
            schema: nodeActivitiesSchemaFor(adaptiveNodeSchemaType(node)),
            schemaName: "adaptive_node_activities",
            operation: step,
            prompt: [
              generationLanguageRule(context.generationSettings),
              TEACHING_STYLE,
              "Generate focused remediation activities for this adaptive node.",
              "Every concept reference MUST belong to this node's targetConceptKeys, including cards, conceptWeights, and expectedConcepts. Core content is reference material only; do not copy its other concept keys. Put answer keys only in evaluationConfig.",
              `NODE:\n${JSON.stringify(node)}`,
              `ALLOWED TARGET CONCEPTS:\n${JSON.stringify(context.concepts.filter((concept) => node.targetConceptKeys.includes(concept.key)))}`,
              `RELEVANT CORE CONTENT:\n${JSON.stringify(context.coreContent)}`,
            ].join("\n\n"),
          });
          const validated = parseGeneratedAdaptiveActivities(node, output, nodeIndex);
          generated[nodeIndex] = parseAdaptiveActivities(
            node,
            await this.lessonImages.enrich(validated, payload.generationRunId, String(nodeIndex)),
            nodeIndex,
          );
          await this.adaptive.saveCheckpoint(payload.generationRunId, plan, generated);
        }
        const completeNodes = generated.filter((node): node is NodeActivities => node !== null);
        if (completeNodes.length !== plan.nodes.length)
          throw new AdaptiveContentError("Adaptive generation has missing nodes.");
        await this.adaptive.complete(payload.generationRunId, "generate_adaptive_activities", {
          nodeCount: generated.length,
          plan,
          generated: completeNodes,
        });
        step = "validate_adaptive_content";
        await this.adaptive.begin(payload.generationRunId, step);
        await this.adaptive.finalize(payload, context, plan, completeNodes);
      } catch (error) {
        const failure = adaptiveFailure(error);
        const willRetry =
          failure.retryable &&
          attemptNumber < ADAPTIVE_MAX_ATTEMPTS &&
          job.attemptsMade + 1 < (job.opts.attempts ?? 1);
        console.error(
          JSON.stringify({
            level: "error",
            event: "adaptive.job_attempt_failed",
            runId: payload.generationRunId,
            moduleId: payload.moduleId,
            interventionId: payload.adaptiveInterventionId,
            jobId: job.id,
            step,
            attemptNumber,
            latencyMs: Math.round(performance.now() - startedAt),
            failureCategory: willRetry ? "retryable" : "terminal",
            failureCode: failure.code,
            ...adaptiveErrorDetails(error),
          }),
        );
        try {
          if (willRetry) {
            const nextRetryAt = new Date(
              Date.now() + ADAPTIVE_RETRY_DELAY_MS * 2 ** job.attemptsMade,
            ).toISOString();
            await this.adaptive.scheduleRetry(payload.generationRunId, nextRetryAt);
          } else {
            await this.adaptive.fail(payload, failure);
          }
        } catch (persistenceError) {
          console.error(
            JSON.stringify({
              level: "error",
              event: "adaptive.failure_persistence_failed",
              runId: payload.generationRunId,
              ...adaptiveErrorDetails(persistenceError),
            }),
          );
          throw persistenceError;
        }
        if (willRetry) throw error;
        const terminalError = new UnrecoverableError(failure.code);
        terminalError.cause = error;
        throw terminalError;
      }
    });
  }
}
