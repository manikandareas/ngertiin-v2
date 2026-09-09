import { randomUUID } from "node:crypto";
import {
  Inject,
  Injectable,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from "@nestjs/common";
import {
  type GenerationSettings,
  type GenerationStatus,
  parseStoredGenerationSettings,
} from "@ngertiin/contracts/api";
import {
  ADAPTIVE_GENERATION_STEPS,
  ADAPTIVE_MAX_ATTEMPTS,
  ADAPTIVE_RETRY_DELAY_MS,
  type AdaptiveGenerationJob,
  type AdaptiveGenerationStep,
  readAdaptiveRunMetadata,
} from "@ngertiin/contracts/jobs";
import {
  activities,
  adaptive_intervention_concepts,
  adaptive_interventions,
  generation_requests,
  generation_run_steps,
  generation_runs,
  module_concepts,
  module_nodes,
  modules,
  node_concepts,
  node_progress,
} from "@ngertiin/database";
import { and, asc, eq, gt, inArray, sql } from "drizzle-orm";
import { InfrastructureService } from "../infrastructure/infrastructure.service.js";
import type { NodeActivities } from "../modules/modules.schemas.js";
import type { AdaptivePlan } from "./adaptive.schemas.js";
import {
  adaptiveErrorDetails,
  parseAdaptiveActivities,
  validateAdaptivePlan,
} from "./adaptive-content.js";

const POLL_MS = 2_000;
const SAFE_FAILURE = {
  code: "GENERATION_FAILED" as const,
  message: "Adaptive content generation could not be completed.",
  retryable: false,
};

export type AdaptiveContext = {
  attemptNumber: number;
  generationSettings: GenerationSettings | null;
  userId: string;
  triggerNodeId: string;
  resumeNodeId: string | null;
  concepts: Array<{
    id: string;
    key: string;
    name: string;
    description: string | null;
    masteryScore: number;
  }>;
  coreContent: Array<{ nodeTitle: string; activityType: string; content: unknown }>;
};

@Injectable()
export class AdaptiveService implements OnApplicationBootstrap, OnApplicationShutdown {
  private timer?: ReturnType<typeof setInterval>;
  private polling = false;
  private dispatchCursor?: string;
  constructor(
    @Inject(InfrastructureService) private readonly infrastructure: InfrastructureService,
  ) {}

  onApplicationBootstrap(): void {
    void this.poll();
    this.timer = setInterval(() => void this.poll(), POLL_MS);
    this.timer.unref();
  }
  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async withRunLock<Result>(runId: string, operation: () => Promise<Result>): Promise<Result> {
    const connection = await this.infrastructure.database.connection.reserve();
    try {
      await connection`select pg_advisory_lock(hashtextextended(${`adaptive-generation:${runId}`}, 0))`;
      try {
        return await operation();
      } finally {
        await connection`select pg_advisory_unlock(hashtextextended(${`adaptive-generation:${runId}`}, 0))`;
      }
    } finally {
      connection.release();
    }
  }

  async start(payload: AdaptiveGenerationJob, jobId?: string): Promise<AdaptiveContext | null> {
    return this.infrastructure.database.db.transaction(async (transaction) => {
      const [run] = await transaction
        .select({
          status: generation_runs.status,
          userId: generation_runs.user_id,
          moduleId: generation_runs.module_id,
          interventionId: generation_runs.adaptive_intervention_id,
          type: generation_runs.type,
          startedAt: generation_runs.started_at,
          metadata: generation_runs.metadata,
          jobId: generation_runs.bullmq_job_id,
        })
        .from(generation_runs)
        .where(eq(generation_runs.id, payload.generationRunId))
        .for("update")
        .limit(1);
      if (
        run?.type !== "adaptive" ||
        run.moduleId !== payload.moduleId ||
        run.interventionId !== payload.adaptiveInterventionId
      )
        throw new Error("Invalid adaptive generation context.");
      if (run.status === "completed" || run.status === "failed") return null;
      if (jobId && run.jobId && jobId !== run.jobId) return null;
      const [intervention] = await transaction
        .select({
          triggerNodeId: adaptive_interventions.trigger_node_id,
          resumeNodeId: adaptive_interventions.resume_node_id,
          status: adaptive_interventions.status,
        })
        .from(adaptive_interventions)
        .where(
          and(
            eq(adaptive_interventions.id, payload.adaptiveInterventionId),
            eq(adaptive_interventions.user_id, run.userId),
          ),
        )
        .limit(1);
      if (intervention?.status !== "generating")
        throw new Error("Invalid adaptive intervention state.");
      const concepts = await transaction
        .select({
          id: module_concepts.id,
          key: module_concepts.key,
          name: module_concepts.name,
          description: module_concepts.description,
          masteryScore: adaptive_intervention_concepts.mastery_score,
        })
        .from(adaptive_intervention_concepts)
        .innerJoin(
          module_concepts,
          eq(module_concepts.id, adaptive_intervention_concepts.concept_id),
        )
        .where(
          eq(
            adaptive_intervention_concepts.adaptive_intervention_id,
            payload.adaptiveInterventionId,
          ),
        )
        .orderBy(asc(module_concepts.position));
      const conceptIds = concepts.map((concept) => concept.id);
      if (conceptIds.length === 0) throw new Error("Adaptive intervention has no target concepts.");
      const coreContent = await transaction
        .select({
          nodeTitle: module_nodes.title,
          activityType: activities.type,
          content: activities.content,
        })
        .from(node_concepts)
        .innerJoin(module_nodes, eq(module_nodes.id, node_concepts.node_id))
        .innerJoin(activities, eq(activities.node_id, module_nodes.id))
        .where(
          and(
            eq(module_nodes.module_id, payload.moduleId),
            eq(module_nodes.origin, "core"),
            inArray(node_concepts.concept_id, conceptIds),
          ),
        )
        .orderBy(asc(module_nodes.core_position), asc(activities.position));
      const metadata = readAdaptiveRunMetadata(run.metadata);
      const attemptNumber = metadata.attemptNumber + 1;
      await transaction
        .update(generation_runs)
        .set({
          status: "processing",
          started_at: run.startedAt ?? new Date(),
          error: null,
          metadata: { ...metadata, attemptNumber, nextRetryAt: null },
        })
        .where(eq(generation_runs.id, payload.generationRunId));
      await transaction
        .update(generation_run_steps)
        .set({ status: "pending", finished_at: null })
        .where(
          and(
            eq(generation_run_steps.generation_run_id, payload.generationRunId),
            eq(generation_run_steps.status, "processing"),
          ),
        );
      const [module] = await transaction
        .select({ settings: generation_requests.generation_settings })
        .from(modules)
        .innerJoin(generation_requests, eq(generation_requests.id, modules.generation_request_id))
        .where(eq(modules.id, payload.moduleId))
        .limit(1);
      return {
        attemptNumber,
        generationSettings: parseStoredGenerationSettings(module?.settings),
        userId: run.userId,
        triggerNodeId: intervention.triggerNodeId,
        resumeNodeId: intervention.resumeNodeId,
        concepts: concepts.map((concept) => ({
          ...concept,
          masteryScore: Number(concept.masteryScore),
        })),
        coreContent,
      };
    });
  }

  async begin(runId: string, step: AdaptiveGenerationStep): Promise<void> {
    const definition = ADAPTIVE_GENERATION_STEPS.find((item) => item.name === step);
    if (!definition) throw new Error("Unknown adaptive generation step.");
    await this.infrastructure.database.db.transaction(async (transaction) => {
      await transaction
        .update(generation_run_steps)
        .set({
          status: "processing",
          error: null,
          finished_at: null,
          started_at: sql`coalesce(${generation_run_steps.started_at}, now())`,
        })
        .where(
          and(
            eq(generation_run_steps.generation_run_id, runId),
            eq(generation_run_steps.step, step),
          ),
        );
      await transaction
        .update(generation_runs)
        .set({
          progress_percentage: sql`greatest(${generation_runs.progress_percentage}, ${definition.startProgress})`,
        })
        .where(eq(generation_runs.id, runId));
    });
  }

  async readCheckpoint(runId: string): Promise<unknown> {
    const [step] = await this.infrastructure.database.db
      .select({ metadata: generation_run_steps.metadata })
      .from(generation_run_steps)
      .where(
        and(
          eq(generation_run_steps.generation_run_id, runId),
          eq(generation_run_steps.step, "generate_adaptive_activities"),
        ),
      )
      .limit(1);
    return step?.metadata;
  }

  async scheduleRetry(runId: string, nextRetryAt: string): Promise<void> {
    await this.infrastructure.database.db
      .update(generation_runs)
      .set({
        metadata: sql`coalesce(${generation_runs.metadata}, '{}'::jsonb) || ${JSON.stringify({ nextRetryAt })}::jsonb`,
      })
      .where(and(eq(generation_runs.id, runId), eq(generation_runs.status, "processing")));
  }

  async saveCheckpoint(
    runId: string,
    plan: AdaptivePlan,
    generated: Array<NodeActivities | null>,
  ): Promise<void> {
    await this.infrastructure.database.db
      .update(generation_run_steps)
      .set({ metadata: { plan, generated } })
      .where(
        and(
          eq(generation_run_steps.generation_run_id, runId),
          eq(generation_run_steps.step, "generate_adaptive_activities"),
        ),
      );
  }

  async complete(
    runId: string,
    step: AdaptiveGenerationStep,
    metadata: Record<string, unknown> = {},
  ): Promise<void> {
    const definition = ADAPTIVE_GENERATION_STEPS.find((item) => item.name === step);
    if (!definition) throw new Error("Unknown adaptive generation step.");
    await this.infrastructure.database.db.transaction(async (transaction) => {
      await transaction
        .update(generation_run_steps)
        .set({ status: "completed", metadata, finished_at: new Date() })
        .where(
          and(
            eq(generation_run_steps.generation_run_id, runId),
            eq(generation_run_steps.step, step),
          ),
        );
      await transaction
        .update(generation_runs)
        .set({
          progress_percentage: sql`greatest(${generation_runs.progress_percentage}, ${definition.completedProgress})`,
        })
        .where(eq(generation_runs.id, runId));
    });
  }

  async finalize(
    payload: AdaptiveGenerationJob,
    context: AdaptiveContext,
    plan: AdaptivePlan,
    generated: NodeActivities[],
  ): Promise<void> {
    await this.infrastructure.database.db.transaction(async (transaction) => {
      const [run] = await transaction
        .select({ status: generation_runs.status })
        .from(generation_runs)
        .where(eq(generation_runs.id, payload.generationRunId))
        .for("update")
        .limit(1);
      if (!run || run.status === "completed") return;
      if (run.status !== "processing" || plan.nodes.length !== generated.length)
        throw new Error("Invalid adaptive finalization state.");
      const conceptByKey = new Map(context.concepts.map((concept) => [concept.key, concept.id]));
      validateAdaptivePlan(plan, [...conceptByKey.keys()]);
      for (const [index, output] of generated.entries()) {
        const node = plan.nodes[index];
        if (node) parseAdaptiveActivities(node, output, index);
      }
      const now = new Date();
      const nodes = plan.nodes.map((node, index) => ({
        ...node,
        id: randomUUID(),
        position: index + 1,
      }));
      await transaction.insert(module_nodes).values(
        nodes.map((node) => ({
          id: node.id,
          module_id: payload.moduleId,
          origin: "adaptive" as const,
          type: node.type,
          title: node.title,
          description: node.description,
          adaptive_intervention_id: payload.adaptiveInterventionId,
          adaptive_position: node.position,
          created_at: now,
          updated_at: now,
        })),
      );
      await transaction.insert(node_concepts).values(
        nodes.flatMap((node) =>
          node.targetConceptKeys.map((key) => ({
            node_id: node.id,
            concept_id: conceptByKey.get(key) as string,
            relation: (node.type === "remedial_quiz" ? "assess" : "review") as "assess" | "review",
            weight: "1",
          })),
        ),
      );
      await transaction.insert(activities).values(
        nodes.flatMap(
          (node, nodeIndex) =>
            generated[nodeIndex]?.activities.map((activity, index) => ({
              id: randomUUID(),
              node_id: node.id,
              type: activity.type,
              position: index + 1,
              content: activity.content,
              evaluation_config: "evaluationConfig" in activity ? activity.evaluationConfig : null,
              schema_version: activity.type === "lesson" && "format" in activity.content ? 2 : 1,
              created_at: now,
              updated_at: now,
            })) ?? [],
        ),
      );
      await transaction.insert(node_progress).values(
        nodes.map((node, index) => ({
          user_id: context.userId,
          node_id: node.id,
          status: index === 0 ? ("available" as const) : ("locked" as const),
          attempt_count: 0,
          updated_at: now,
        })),
      );
      await transaction
        .update(adaptive_interventions)
        .set({ status: "available", reason_summary: plan.reasonSummary })
        .where(eq(adaptive_interventions.id, payload.adaptiveInterventionId));
      await transaction
        .update(generation_run_steps)
        .set({
          status: "completed",
          metadata: { validated: true, nodeCount: nodes.length },
          finished_at: now,
        })
        .where(
          and(
            eq(generation_run_steps.generation_run_id, payload.generationRunId),
            eq(generation_run_steps.step, "validate_adaptive_content"),
          ),
        );
      await transaction
        .update(generation_runs)
        .set({ status: "completed", progress_percentage: 100, finished_at: now, error: null })
        .where(eq(generation_runs.id, payload.generationRunId));
    });
  }

  async fail(
    payload: AdaptiveGenerationJob,
    failure: NonNullable<GenerationStatus["failure"]> = SAFE_FAILURE,
    expectedRetryCount?: number,
  ): Promise<void> {
    await this.infrastructure.database.db.transaction(async (transaction) => {
      const [run] = await transaction
        .select({ status: generation_runs.status, metadata: generation_runs.metadata })
        .from(generation_runs)
        .where(eq(generation_runs.id, payload.generationRunId))
        .for("update")
        .limit(1);
      if (!run || run.status === "completed" || run.status === "failed") return;
      if (
        expectedRetryCount !== undefined &&
        readAdaptiveRunMetadata(run.metadata).retryCount !== expectedRetryCount
      )
        return;
      const now = new Date();
      await transaction
        .update(generation_run_steps)
        .set({
          status: "failed",
          error: failure,
          finished_at: now,
        })
        .where(
          and(
            eq(generation_run_steps.generation_run_id, payload.generationRunId),
            eq(generation_run_steps.status, "processing"),
          ),
        );
      await transaction
        .update(generation_runs)
        .set({
          status: "failed",
          error: failure,
          finished_at: now,
          metadata: sql`coalesce(${generation_runs.metadata}, '{}'::jsonb) || '{"nextRetryAt":null}'::jsonb`,
        })
        .where(eq(generation_runs.id, payload.generationRunId));
      await transaction
        .update(adaptive_interventions)
        .set({ status: "failed" })
        .where(eq(adaptive_interventions.id, payload.adaptiveInterventionId));
    });
  }

  private async poll(): Promise<void> {
    if (this.polling) return;
    this.polling = true;
    try {
      const runs = await this.infrastructure.database.db
        .select({
          generationRunId: generation_runs.id,
          moduleId: generation_runs.module_id,
          adaptiveInterventionId: generation_runs.adaptive_intervention_id,
          metadata: generation_runs.metadata,
        })
        .from(generation_runs)
        .where(
          and(
            eq(generation_runs.type, "adaptive"),
            inArray(generation_runs.status, ["queued", "processing"]),
            this.dispatchCursor ? gt(generation_runs.id, this.dispatchCursor) : undefined,
          ),
        )
        .orderBy(asc(generation_runs.id))
        .limit(25);
      for (const run of runs)
        if (run.adaptiveInterventionId) {
          const payload: AdaptiveGenerationJob = {
            generationRunId: run.generationRunId,
            moduleId: run.moduleId,
            adaptiveInterventionId: run.adaptiveInterventionId,
          };
          const metadata = readAdaptiveRunMetadata(run.metadata);
          const jobId = metadata.retryCount
            ? `${run.generationRunId}-retry-${metadata.retryCount}`
            : run.generationRunId;
          const existing = await this.infrastructure.adaptiveGenerationQueue.getJob(jobId);
          const state = await existing?.getState();
          // A terminal queue job must never silently restart the same generation cycle.
          // Reconcile PostgreSQL if recording the failure previously failed or the worker stalled.
          if (
            state === "failed" ||
            state === "completed" ||
            (!existing && metadata.attemptNumber >= ADAPTIVE_MAX_ATTEMPTS)
          ) {
            await this.fail(payload, { ...SAFE_FAILURE, retryable: true }, metadata.retryCount);
            continue;
          }
          const outcome = await this.infrastructure.ensureJob({
            queue: this.infrastructure.adaptiveGenerationQueue,
            name: "generate-adaptive",
            data: payload,
            jobId,
            options: {
              attempts: ADAPTIVE_MAX_ATTEMPTS,
              backoff: { type: "exponential", delay: ADAPTIVE_RETRY_DELAY_MS },
            },
          });
          await this.infrastructure.database.db
            .update(generation_runs)
            .set({ bullmq_job_id: jobId })
            .where(
              and(
                eq(generation_runs.id, run.generationRunId),
                sql`coalesce((${generation_runs.metadata}->>'retryCount')::int, 0) = ${metadata.retryCount}`,
              ),
            );
          if (outcome !== "preserved")
            console.log(
              JSON.stringify({
                level: "log",
                event: "adaptive.dispatched",
                runId: run.generationRunId,
                moduleId: run.moduleId,
                interventionId: run.adaptiveInterventionId,
                outcome,
              }),
            );
        }
      this.dispatchCursor = runs.length === 25 ? runs.at(-1)?.generationRunId : undefined;
    } catch (error) {
      console.error(
        JSON.stringify({
          level: "error",
          event: "adaptive.dispatch_failed",
          ...adaptiveErrorDetails(error),
        }),
      );
    } finally {
      this.polling = false;
    }
  }
}
