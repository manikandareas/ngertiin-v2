import { createHash, randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import type {
  AdaptiveDecisionBody,
  AdaptiveIntervention,
  GenerationPhase,
} from "@ngertiin/contracts/api";
import {
  ADAPTIVE_GENERATION_STEPS,
  ADAPTIVE_MAX_ATTEMPTS,
  ADAPTIVE_MAX_RETRIES,
  readAdaptiveRunMetadata,
} from "@ngertiin/contracts/jobs";
import {
  adaptive_intervention_concepts,
  adaptive_interventions,
  generation_run_steps,
  generation_runs,
  module_concepts,
  module_nodes,
  modules,
  node_progress,
  user_module_progress,
} from "@ngertiin/database";
import { selectLearningAction } from "@ngertiin/shared";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { ProductError } from "../http/product-error.js";
import { IdempotencyService } from "../idempotency/idempotency.service.js";
import { InfrastructureService } from "../infrastructure/infrastructure.service.js";

const failureSchema = z
  .object({
    code: z.enum([
      "GENERATION_PROVIDER_UNAVAILABLE",
      "GENERATION_INVALID_OUTPUT",
      "GENERATION_CONTEXT_INVALID",
      "GENERATION_FAILED",
    ]),
    message: z.string(),
    retryable: z.boolean(),
  })
  .strict();

@Injectable()
export class AdaptiveService {
  constructor(
    @Inject(InfrastructureService) private readonly infrastructure: InfrastructureService,
    @Inject(IdempotencyService) private readonly idempotency: IdempotencyService,
  ) {}

  async decide(userId: string, interventionId: string, key: string, input: AdaptiveDecisionBody) {
    const route = `/api/v1/adaptive-interventions/${interventionId}/decision`;
    const payloadHash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
    return this.idempotency.execute(
      {
        userId,
        method: "POST",
        route,
        key,
        payloadHash,
        replayStatus: 200,
        payloadConflictError: new ProductError(
          409,
          "ADAPTIVE_DECISION_ALREADY_MADE",
          "Adaptive decision already made",
          "This adaptive intervention already has a different decision.",
        ),
      },
      async (transaction) => {
        const [intervention] = await transaction
          .select({
            id: adaptive_interventions.id,
            status: adaptive_interventions.status,
            moduleId: adaptive_interventions.module_id,
            moduleStatus: modules.status,
          })
          .from(adaptive_interventions)
          .innerJoin(modules, eq(modules.id, adaptive_interventions.module_id))
          .where(
            and(
              eq(adaptive_interventions.id, interventionId),
              eq(adaptive_interventions.user_id, userId),
              eq(modules.owner_id, userId),
            ),
          )
          .for("update")
          .limit(1);
        if (!intervention) this.notFound();
        if (intervention.moduleStatus !== "ready") {
          throw new ProductError(
            409,
            "MODULE_NOT_LEARNABLE",
            "Module is not learnable",
            "Only a ready Module accepts adaptive decisions.",
          );
        }
        if (intervention.status !== "offered") {
          const sameDecision =
            input.decision === "accept"
              ? ["generating", "available", "in_progress", "completed", "failed"].includes(
                  intervention.status,
                )
              : intervention.status === "skipped";
          if (sameDecision) {
            return {
              status: 200,
              body: { data: await this.read(userId, intervention.id, transaction) },
            };
          }
          throw new ProductError(
            409,
            "ADAPTIVE_DECISION_ALREADY_MADE",
            "Adaptive decision already made",
            "This adaptive intervention no longer accepts a decision.",
          );
        }
        if (input.decision === "accept") {
          const runId = randomUUID();
          await transaction
            .update(adaptive_interventions)
            .set({ status: "generating" })
            .where(eq(adaptive_interventions.id, intervention.id));
          await transaction.insert(generation_runs).values({
            id: runId,
            user_id: userId,
            module_id: intervention.moduleId,
            adaptive_intervention_id: intervention.id,
            type: "adaptive",
            status: "queued",
            progress_percentage: 0,
          });
          await transaction.insert(generation_run_steps).values(
            ADAPTIVE_GENERATION_STEPS.map((step, index) => ({
              generation_run_id: runId,
              step: step.name,
              position: index + 1,
              status: "pending" as const,
            })),
          );
        } else {
          await transaction
            .update(adaptive_interventions)
            .set({ status: "skipped", completed_at: new Date() })
            .where(eq(adaptive_interventions.id, intervention.id));
        }
        const data = await this.read(userId, intervention.id, transaction);
        return { status: input.decision === "accept" ? 202 : 200, body: { data } };
      },
    );
  }

  get(userId: string, interventionId: string): Promise<AdaptiveIntervention> {
    return this.read(userId, interventionId, this.infrastructure.database.db);
  }

  async retry(userId: string, interventionId: string, key: string) {
    return this.idempotency.execute(
      {
        userId,
        method: "POST",
        route: `/api/v1/adaptive-interventions/${interventionId}/retry`,
        key,
        payloadHash: createHash("sha256").update("{}").digest("hex"),
      },
      async (transaction) => {
        const [owned] = await transaction
          .select({ runId: generation_runs.id })
          .from(generation_runs)
          .innerJoin(
            adaptive_interventions,
            eq(adaptive_interventions.id, generation_runs.adaptive_intervention_id),
          )
          .innerJoin(modules, eq(modules.id, adaptive_interventions.module_id))
          .where(
            and(
              eq(adaptive_interventions.id, interventionId),
              eq(adaptive_interventions.user_id, userId),
              eq(modules.owner_id, userId),
            ),
          )
          .limit(1);
        if (!owned) this.notFound();
        // Match the worker's lock order; a stale worker must finish before this run can be reset.
        await transaction.execute(
          sql`select pg_advisory_xact_lock(hashtextextended(${`adaptive-generation:${owned.runId}`}, 0))`,
        );
        const [run] = await transaction
          .select({
            status: generation_runs.status,
            metadata: generation_runs.metadata,
            error: generation_runs.error,
            interventionStatus: adaptive_interventions.status,
            moduleStatus: modules.status,
          })
          .from(generation_runs)
          .innerJoin(
            adaptive_interventions,
            eq(adaptive_interventions.id, generation_runs.adaptive_intervention_id),
          )
          .innerJoin(modules, eq(modules.id, adaptive_interventions.module_id))
          .where(eq(generation_runs.id, owned.runId))
          .for("update")
          .limit(1);
        const metadata = readAdaptiveRunMetadata(run?.metadata);
        const failure = failureSchema.safeParse(run?.error);
        if (
          run?.status !== "failed" ||
          run.interventionStatus !== "failed" ||
          run.moduleStatus !== "ready" ||
          !failure.success ||
          !failure.data.retryable ||
          metadata.retryCount >= ADAPTIVE_MAX_RETRIES
        ) {
          throw new ProductError(
            409,
            "GENERATION_RETRY_NOT_ALLOWED",
            "Generation retry is not allowed",
            "Penguatan ini belum dapat dicoba ulang. Kamu tetap bisa melanjutkan perjalanan utama.",
          );
        }
        const retryCount = metadata.retryCount + 1;
        await transaction
          .update(generation_runs)
          .set({
            status: "queued",
            progress_percentage: 0,
            error: null,
            started_at: null,
            finished_at: null,
            bullmq_job_id: `${owned.runId}-retry-${retryCount}`,
            metadata: { attemptNumber: 0, retryCount, nextRetryAt: null },
          })
          .where(eq(generation_runs.id, owned.runId));
        // Keep validated checkpoints; the worker revalidates each cached node before reuse.
        await transaction
          .update(generation_run_steps)
          .set({ status: "pending", error: null, started_at: null, finished_at: null })
          .where(eq(generation_run_steps.generation_run_id, owned.runId));
        await transaction
          .update(adaptive_interventions)
          .set({ status: "generating" })
          .where(eq(adaptive_interventions.id, interventionId));
        return {
          status: 202,
          body: { data: await this.read(userId, interventionId, transaction) },
        };
      },
    );
  }

  async generationEventData(userId: string, interventionId: string) {
    const intervention = await this.get(userId, interventionId);
    if (!intervention.generation)
      throw new ProductError(
        409,
        "GENERATION_NOT_AVAILABLE",
        "Generation is not available",
        "This intervention has no generation state.",
      );
    return { generation: intervention.generation, nextAction: intervention.nextAction };
  }

  private async read(
    userId: string,
    interventionId: string,
    database: typeof this.infrastructure.database.db,
  ): Promise<AdaptiveIntervention> {
    const [row] = await database
      .select({
        id: adaptive_interventions.id,
        moduleId: adaptive_interventions.module_id,
        status: adaptive_interventions.status,
        reasonSummary: adaptive_interventions.reason_summary,
        triggerNodeId: adaptive_interventions.trigger_node_id,
        triggerAttemptId: adaptive_interventions.trigger_attempt_id,
        resumeNodeId: adaptive_interventions.resume_node_id,
        createdAt: adaptive_interventions.created_at,
        completedAt: adaptive_interventions.completed_at,
        moduleStatus: modules.status,
      })
      .from(adaptive_interventions)
      .innerJoin(modules, eq(modules.id, adaptive_interventions.module_id))
      .where(
        and(
          eq(adaptive_interventions.id, interventionId),
          eq(adaptive_interventions.user_id, userId),
          eq(modules.owner_id, userId),
        ),
      )
      .limit(1);
    if (!row) this.notFound();
    const [concepts, nodeRows, progressRows, run] = await Promise.all([
      database
        .select({
          key: module_concepts.key,
          name: module_concepts.name,
          masteryScore: adaptive_intervention_concepts.mastery_score,
        })
        .from(adaptive_intervention_concepts)
        .innerJoin(
          module_concepts,
          eq(module_concepts.id, adaptive_intervention_concepts.concept_id),
        )
        .where(eq(adaptive_intervention_concepts.adaptive_intervention_id, row.id))
        .orderBy(asc(module_concepts.position)),
      database
        .select({
          id: module_nodes.id,
          origin: module_nodes.origin,
          type: module_nodes.type,
          title: module_nodes.title,
          description: module_nodes.description,
          position: module_nodes.adaptive_position,
          interventionId: module_nodes.adaptive_intervention_id,
          status: node_progress.status,
          bestScore: node_progress.best_score,
          attemptCount: node_progress.attempt_count,
        })
        .from(module_nodes)
        .innerJoin(
          node_progress,
          and(eq(node_progress.node_id, module_nodes.id), eq(node_progress.user_id, userId)),
        )
        .where(eq(module_nodes.adaptive_intervention_id, row.id))
        .orderBy(asc(module_nodes.adaptive_position)),
      database
        .select({
          status: user_module_progress.status,
          currentNodeId: user_module_progress.current_node_id,
          currentNodeStatus: node_progress.status,
        })
        .from(user_module_progress)
        .leftJoin(
          node_progress,
          and(
            eq(node_progress.node_id, user_module_progress.current_node_id),
            eq(node_progress.user_id, userId),
          ),
        )
        .where(
          and(
            eq(user_module_progress.user_id, userId),
            eq(user_module_progress.module_id, row.moduleId),
          ),
        )
        .limit(1),
      database
        .select({
          id: generation_runs.id,
          status: generation_runs.status,
          progressPercentage: generation_runs.progress_percentage,
          error: generation_runs.error,
          startedAt: generation_runs.started_at,
          finishedAt: generation_runs.finished_at,
          metadata: generation_runs.metadata,
        })
        .from(generation_runs)
        .where(eq(generation_runs.adaptive_intervention_id, row.id))
        .orderBy(desc(generation_runs.created_at))
        .limit(1),
    ]);
    const generation = run[0] ? await this.mapGeneration(database, run[0]) : null;
    const nodes = nodeRows.map((node) => ({
      id: node.id,
      origin: node.origin,
      type: node.type,
      title: node.title,
      description: node.description,
      position: node.position ?? 1,
      progress: {
        status: node.status,
        bestScore: node.bestScore === null ? null : Number(node.bestScore),
        attemptCount: node.attemptCount,
      },
      interventionId: node.interventionId ?? undefined,
    }));
    const firstNodeId =
      nodes.find((node) => node.progress.status === "available")?.id ?? nodes[0]?.id ?? null;
    const activeNodeId =
      nodes.find((node) => node.progress.status === "in_progress")?.id ?? firstNodeId;
    const moduleProgress = progressRows[0];
    const nextAction = selectLearningAction({
      moduleId: row.moduleId,
      moduleStatus: row.moduleStatus,
      moduleProgressStatus: moduleProgress?.status ?? null,
      currentCoreNodeId: moduleProgress?.currentNodeId ?? null,
      currentCoreNodeStatus: moduleProgress?.currentNodeStatus ?? undefined,
      intervention: {
        id: row.id,
        triggerAttemptId: row.triggerAttemptId,
        status: row.status,
        firstNodeId,
        activeNodeId,
      },
    });
    return {
      id: row.id,
      moduleId: row.moduleId,
      status: row.status,
      required: false,
      reasonSummary: row.reasonSummary,
      triggerNodeId: row.triggerNodeId,
      resumeNodeId: row.resumeNodeId,
      targetConcepts: concepts.map((concept) => ({
        ...concept,
        masteryScore: Number(concept.masteryScore),
      })),
      nodes,
      generation,
      nextAction,
      coreNextAction: selectLearningAction({
        moduleId: row.moduleId,
        moduleStatus: row.moduleStatus,
        moduleProgressStatus: moduleProgress?.status ?? null,
        currentCoreNodeId: moduleProgress?.currentNodeId ?? null,
        currentCoreNodeStatus: moduleProgress?.currentNodeStatus ?? undefined,
      }),
      createdAt: row.createdAt.toISOString(),
      completedAt: row.completedAt?.toISOString() ?? null,
    };
  }

  private async mapGeneration(
    database: typeof this.infrastructure.database.db,
    run: {
      id: string;
      status: "queued" | "processing" | "completed" | "failed";
      progressPercentage: number;
      error: unknown;
      startedAt: Date | null;
      finishedAt: Date | null;
      metadata: unknown;
    },
  ): Promise<NonNullable<AdaptiveIntervention["generation"]>> {
    const steps = await database
      .select({ step: generation_run_steps.step, status: generation_run_steps.status })
      .from(generation_run_steps)
      .where(eq(generation_run_steps.generation_run_id, run.id))
      .orderBy(asc(generation_run_steps.position));
    const phaseByStep = new Map<string, GenerationPhase>(
      ADAPTIVE_GENERATION_STEPS.map((step) => [step.name, step.phase]),
    );
    const current =
      run.status === "failed"
        ? steps.find((step) => step.status === "failed")
        : (steps.find((step) => step.status === "processing") ??
          steps.find((step) => step.status === "pending"));
    const failure = failureSchema.safeParse(run.error);
    const metadata = readAdaptiveRunMetadata(run.metadata);
    return {
      retriesRemaining: Math.max(0, ADAPTIVE_MAX_RETRIES - metadata.retryCount),
      attemptNumber: metadata.attemptNumber,
      maxAttempts: ADAPTIVE_MAX_ATTEMPTS,
      nextRetryAt: metadata.nextRetryAt,
      state: run.status,
      progressPercentage: run.progressPercentage,
      currentPhase: current ? (phaseByStep.get(current.step) ?? null) : null,
      phases: steps.flatMap((step) => {
        const phase = phaseByStep.get(step.step);
        return phase ? [{ phase, status: step.status }] : [];
      }),
      failure:
        run.status === "failed"
          ? failure.success
            ? failure.data
            : {
                code: "GENERATION_FAILED",
                message: "Adaptive content generation could not be completed.",
                retryable: false,
              }
          : null,
      startedAt: run.startedAt?.toISOString() ?? null,
      finishedAt: run.finishedAt?.toISOString() ?? null,
    };
  }

  private notFound(): never {
    throw new ProductError(
      404,
      "NOT_FOUND",
      "Resource not found",
      "The requested resource was not found.",
    );
  }
}
