import { randomUUID } from "node:crypto";
import {
  Inject,
  Injectable,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from "@nestjs/common";
import { type GenerationSettings, parseStoredGenerationSettings } from "@ngertiin/contracts/api";
import {
  ADAPTIVE_GENERATION_STEPS,
  type AdaptiveGenerationJob,
  type AdaptiveGenerationStep,
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

const POLL_MS = 2_000;
const SAFE_FAILURE = {
  code: "GENERATION_FAILED" as const,
  message: "Adaptive content generation could not be completed.",
  retryable: false,
};

export type AdaptiveContext = {
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

  async start(payload: AdaptiveGenerationJob): Promise<AdaptiveContext | null> {
    return this.infrastructure.database.db.transaction(async (transaction) => {
      const [run] = await transaction
        .select({
          status: generation_runs.status,
          userId: generation_runs.user_id,
          moduleId: generation_runs.module_id,
          interventionId: generation_runs.adaptive_intervention_id,
          type: generation_runs.type,
          startedAt: generation_runs.started_at,
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
      await transaction
        .update(generation_runs)
        .set({ status: "processing", started_at: run.startedAt ?? new Date(), error: null })
        .where(eq(generation_runs.id, payload.generationRunId));
      const [module] = await transaction
        .select({ settings: generation_requests.generation_settings })
        .from(modules)
        .innerJoin(generation_requests, eq(generation_requests.id, modules.generation_request_id))
        .where(eq(modules.id, payload.moduleId))
        .limit(1);
      return {
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
      if (plan.nodes.some((node) => node.targetConceptKeys.some((key) => !conceptByKey.has(key))))
        throw new Error("Adaptive plan references an unrelated concept.");
      for (const [index, output] of generated.entries()) {
        const allowed = new Set(plan.nodes[index]?.targetConceptKeys ?? []);
        for (const activity of output.activities) {
          const references =
            activity.type === "flashcard"
              ? activity.content.cards.map((card) => card.conceptKey)
              : activity.type === "multiple_choice" || activity.type === "true_false"
                ? activity.evaluationConfig.conceptWeights.map((weight) => weight.conceptKey)
                : activity.type === "short_answer"
                  ? activity.evaluationConfig.expectedConcepts
                  : [];
          if (references.some((key) => !allowed.has(key))) {
            throw new Error("Adaptive activity references an unrelated concept.");
          }
        }
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
              schema_version: 1,
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

  async fail(payload: AdaptiveGenerationJob): Promise<void> {
    await this.infrastructure.database.db.transaction(async (transaction) => {
      const [run] = await transaction
        .select({ status: generation_runs.status })
        .from(generation_runs)
        .where(eq(generation_runs.id, payload.generationRunId))
        .for("update")
        .limit(1);
      if (!run || run.status === "completed" || run.status === "failed") return;
      const now = new Date();
      await transaction
        .update(generation_run_steps)
        .set({
          status: sql`case when ${generation_run_steps.status} = 'processing' then 'failed'::generation_step_status else ${generation_run_steps.status} end`,
          error: SAFE_FAILURE,
          finished_at: sql`case when ${generation_run_steps.status} = 'processing' then ${now} else ${generation_run_steps.finished_at} end`,
        })
        .where(eq(generation_run_steps.generation_run_id, payload.generationRunId));
      await transaction
        .update(generation_runs)
        .set({ status: "failed", error: SAFE_FAILURE, finished_at: now })
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
          const outcome = await this.infrastructure.ensureJob({
            queue: this.infrastructure.adaptiveGenerationQueue,
            name: "generate-adaptive",
            data: payload,
            jobId: run.generationRunId,
            options: { attempts: 3, backoff: { type: "exponential", delay: 5_000 } },
          });
          await this.infrastructure.database.db
            .update(generation_runs)
            .set({ bullmq_job_id: run.generationRunId })
            .where(eq(generation_runs.id, run.generationRunId));
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
          errorType: error instanceof Error ? error.name : "UnknownError",
        }),
      );
    } finally {
      this.polling = false;
    }
  }
}
