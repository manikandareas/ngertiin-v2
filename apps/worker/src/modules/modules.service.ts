import { randomUUID } from "node:crypto";
import {
  Inject,
  Injectable,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from "@nestjs/common";
import {
  MODULE_GENERATION_STEPS,
  type ModuleGenerationJob,
  type ModuleGenerationStep,
} from "@ngertiin/contracts/jobs";
import {
  activities,
  generation_requests,
  generation_run_steps,
  generation_runs,
  module_concepts,
  module_nodes,
  modules,
  node_concepts,
  node_progress,
  user_module_progress,
} from "@ngertiin/database";
import { and, asc, eq, gt, inArray, sql } from "drizzle-orm";
import { InfrastructureService } from "../infrastructure/infrastructure.service.js";
import { invalidContext, invalidOutput, type ModuleGenerationFailure } from "./modules.failure.js";
import type { ConceptMap, CurriculumPlan, NodeActivities } from "./modules.schemas.js";

const DISPATCH_INTERVAL_MILLISECONDS = 2_000;

type StartedRun = {
  readonly userId: string;
  readonly instruction: string | null;
};

type QueuedRun = {
  readonly generationRunId: string;
  readonly moduleId: string;
  readonly generationRequestId: string;
};

@Injectable()
export class ModulesService implements OnApplicationBootstrap, OnApplicationShutdown {
  private timer?: ReturnType<typeof setInterval>;
  private polling = false;
  private dispatchCursor?: string;

  constructor(
    @Inject(InfrastructureService) private readonly infrastructure: InfrastructureService,
  ) {}

  onApplicationBootstrap(): void {
    void this.pollQueuedRuns();
    this.timer = setInterval(() => void this.pollQueuedRuns(), DISPATCH_INTERVAL_MILLISECONDS);
    this.timer.unref();
  }

  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async withRunLock<Result>(runId: string, operation: () => Promise<Result>): Promise<Result> {
    const connection = await this.infrastructure.database.connection.reserve();
    const lockKey = `module-generation:${runId}`;
    try {
      await connection`select pg_advisory_lock(hashtextextended(${lockKey}, 0))`;
      try {
        return await operation();
      } finally {
        await connection`select pg_advisory_unlock(hashtextextended(${lockKey}, 0))`;
      }
    } finally {
      connection.release();
    }
  }

  async startRun(payload: ModuleGenerationJob): Promise<StartedRun | null> {
    return this.infrastructure.database.db.transaction(async (transaction) => {
      const [run] = await transaction
        .select({
          userId: generation_runs.user_id,
          moduleId: generation_runs.module_id,
          generationRequestId: generation_runs.generation_request_id,
          status: generation_runs.status,
          startedAt: generation_runs.started_at,
        })
        .from(generation_runs)
        .where(eq(generation_runs.id, payload.generationRunId))
        .for("update")
        .limit(1);
      if (!run) invalidContext();
      if (run.status === "completed" || run.status === "failed") return null;
      if (
        run.moduleId !== payload.moduleId ||
        run.generationRequestId !== payload.generationRequestId
      ) {
        invalidContext();
      }

      const [request] = await transaction
        .select({
          userId: generation_requests.user_id,
          instruction: generation_requests.instruction,
        })
        .from(generation_requests)
        .where(eq(generation_requests.id, payload.generationRequestId))
        .limit(1);
      if (!request || request.userId !== run.userId) invalidContext();

      await transaction
        .update(generation_runs)
        .set({
          status: "processing",
          started_at: run.startedAt ?? new Date(),
          error: null,
        })
        .where(eq(generation_runs.id, payload.generationRunId));
      return { userId: run.userId, instruction: request.instruction };
    });
  }

  async beginStep(runId: string, stepName: ModuleGenerationStep): Promise<void> {
    const [step] = await this.infrastructure.database.db
      .select({ status: generation_run_steps.status })
      .from(generation_run_steps)
      .where(
        and(
          eq(generation_run_steps.generation_run_id, runId),
          eq(generation_run_steps.step, stepName),
        ),
      )
      .limit(1);
    if (!step) invalidContext(stepName);
    if (step.status === "completed") return;
    const definition = MODULE_GENERATION_STEPS.find(({ name }) => name === stepName);
    if (!definition) invalidContext(stepName);

    await Promise.all([
      this.infrastructure.database.db
        .update(generation_run_steps)
        .set({
          status: "processing",
          error: null,
          started_at: sql`COALESCE(${generation_run_steps.started_at}, NOW())`,
        })
        .where(
          and(
            eq(generation_run_steps.generation_run_id, runId),
            eq(generation_run_steps.step, stepName),
          ),
        ),
      this.infrastructure.database.db
        .update(generation_runs)
        .set({
          progress_percentage: sql`GREATEST(${generation_runs.progress_percentage}, ${definition.startProgress})`,
        })
        .where(eq(generation_runs.id, runId)),
    ]);
  }

  async completeStep(
    runId: string,
    stepName: ModuleGenerationStep,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    const definition = MODULE_GENERATION_STEPS.find(({ name }) => name === stepName);
    if (!definition) invalidContext(stepName);
    const now = new Date();
    await this.infrastructure.database.db.transaction(async (transaction) => {
      await transaction
        .update(generation_run_steps)
        .set({ status: "completed", metadata, error: null, finished_at: now })
        .where(
          and(
            eq(generation_run_steps.generation_run_id, runId),
            eq(generation_run_steps.step, stepName),
          ),
        );
      await transaction
        .update(generation_runs)
        .set({
          progress_percentage: sql`GREATEST(${generation_runs.progress_percentage}, ${definition.completedProgress})`,
        })
        .where(eq(generation_runs.id, runId));
    });
  }

  async updateActivityProgress(runId: string, completed: number, total: number): Promise<void> {
    const progress = 60 + Math.floor((completed / total) * 30);
    await this.infrastructure.database.db
      .update(generation_runs)
      .set({
        progress_percentage: sql`GREATEST(${generation_runs.progress_percentage}, ${progress})`,
      })
      .where(eq(generation_runs.id, runId));
  }

  async currentStep(runId: string): Promise<ModuleGenerationStep> {
    const [step] = await this.infrastructure.database.db
      .select({ step: generation_run_steps.step })
      .from(generation_run_steps)
      .where(
        and(
          eq(generation_run_steps.generation_run_id, runId),
          inArray(generation_run_steps.status, ["processing", "pending"]),
        ),
      )
      .orderBy(
        sql`CASE WHEN ${generation_run_steps.status} = 'processing' THEN 0 ELSE 1 END`,
        asc(generation_run_steps.position),
      )
      .limit(1);
    return MODULE_GENERATION_STEPS.some(({ name }) => name === step?.step)
      ? (step.step as ModuleGenerationStep)
      : "extract_sources";
  }

  async failRun(payload: ModuleGenerationJob, failure: ModuleGenerationFailure): Promise<void> {
    const now = new Date();
    await this.infrastructure.database.db.transaction(async (transaction) => {
      const [run] = await transaction
        .select({ status: generation_runs.status })
        .from(generation_runs)
        .where(eq(generation_runs.id, payload.generationRunId))
        .for("update")
        .limit(1);
      if (!run || run.status === "completed" || run.status === "failed") return;
      await transaction
        .update(generation_run_steps)
        .set({ status: "failed", error: failure.publicFailure, finished_at: now })
        .where(
          and(
            eq(generation_run_steps.generation_run_id, payload.generationRunId),
            eq(generation_run_steps.step, failure.step),
          ),
        );
      await transaction
        .update(generation_runs)
        .set({ status: "failed", error: failure.publicFailure, finished_at: now })
        .where(eq(generation_runs.id, payload.generationRunId));
      await transaction
        .update(modules)
        .set({ status: "failed", updated_at: now })
        .where(eq(modules.id, payload.moduleId));
    });
  }

  async finalizeModule(
    payload: ModuleGenerationJob,
    conceptMap: ConceptMap,
    curriculum: CurriculumPlan,
    generated: Record<string, NodeActivities>,
  ): Promise<void> {
    await this.infrastructure.database.db.transaction(async (transaction) => {
      const [run] = await transaction
        .select({ status: generation_runs.status, userId: generation_runs.user_id })
        .from(generation_runs)
        .where(eq(generation_runs.id, payload.generationRunId))
        .for("update")
        .limit(1);
      if (!run) invalidContext("validate_module");
      if (run.status === "completed") return;
      if (run.status !== "processing") invalidContext("validate_module");

      const now = new Date();
      const conceptsWithIds = conceptMap.concepts.map((concept, position) => ({
        ...concept,
        id: randomUUID(),
        position: position + 1,
      }));
      const conceptIdByKey = new Map(conceptsWithIds.map((concept) => [concept.key, concept.id]));
      await transaction.insert(module_concepts).values(
        conceptsWithIds.map((concept) => ({
          id: concept.id,
          module_id: payload.moduleId,
          key: concept.key,
          name: concept.name,
          description: concept.description ?? null,
          importance: String(concept.importance),
          position: concept.position,
          created_at: now,
        })),
      );

      const nodesWithIds = curriculum.nodes.map((node, position) => ({
        ...node,
        id: randomUUID(),
        position: position + 1,
      }));
      await transaction.insert(module_nodes).values(
        nodesWithIds.map((node) => ({
          id: node.id,
          module_id: payload.moduleId,
          origin: "core" as const,
          type: node.type,
          title: node.title,
          description: node.description ?? null,
          core_position: node.position,
          created_at: now,
          updated_at: now,
        })),
      );
      const nodeConcepts = nodesWithIds.flatMap((node) =>
        node.concepts.map((reference) => {
          const conceptId = conceptIdByKey.get(reference.conceptKey);
          if (!conceptId) invalidOutput("validate_module");
          return {
            node_id: node.id,
            concept_id: conceptId,
            relation: reference.relation,
            weight: String(reference.weight),
          };
        }),
      );
      await transaction.insert(node_concepts).values(nodeConcepts);
      await transaction.insert(activities).values(
        nodesWithIds.flatMap((node) => {
          const nodeActivities = generated[node.key];
          if (!nodeActivities) invalidOutput("validate_module");
          return nodeActivities.activities.map((activity, position) => ({
            id: randomUUID(),
            node_id: node.id,
            type: activity.type,
            position: position + 1,
            content: activity.content,
            evaluation_config: "evaluationConfig" in activity ? activity.evaluationConfig : null,
            schema_version: 1,
            created_at: now,
            updated_at: now,
          }));
        }),
      );

      const firstNode = nodesWithIds[0] as (typeof nodesWithIds)[number];
      await transaction.insert(user_module_progress).values({
        user_id: run.userId,
        module_id: payload.moduleId,
        status: "not_started",
        current_node_id: firstNode.id,
        progress_percentage: "0",
        updated_at: now,
      });
      await transaction.insert(node_progress).values(
        nodesWithIds.map((node, index) => ({
          user_id: run.userId,
          node_id: node.id,
          status: index === 0 ? ("available" as const) : ("locked" as const),
          attempt_count: 0,
          updated_at: now,
        })),
      );
      await transaction
        .update(generation_run_steps)
        .set({
          status: "completed",
          metadata: { validated: true },
          error: null,
          finished_at: now,
        })
        .where(
          and(
            eq(generation_run_steps.generation_run_id, payload.generationRunId),
            eq(generation_run_steps.step, "validate_module"),
          ),
        );
      await transaction
        .update(modules)
        .set({
          title: curriculum.title,
          description: curriculum.description ?? null,
          difficulty: curriculum.difficulty,
          estimated_minutes: curriculum.estimatedMinutes ?? null,
          status: "ready",
          updated_at: now,
        })
        .where(and(eq(modules.id, payload.moduleId), eq(modules.owner_id, run.userId)));
      await transaction
        .update(generation_runs)
        .set({
          status: "completed",
          progress_percentage: 100,
          error: null,
          finished_at: now,
        })
        .where(eq(generation_runs.id, payload.generationRunId));
    });
  }

  private async pollQueuedRuns(): Promise<void> {
    if (this.polling) return;
    this.polling = true;
    try {
      const runs = await this.infrastructure.database.db
        .select({
          generationRunId: generation_runs.id,
          moduleId: generation_runs.module_id,
          generationRequestId: generation_requests.id,
        })
        .from(generation_runs)
        .innerJoin(
          generation_requests,
          eq(generation_requests.id, generation_runs.generation_request_id),
        )
        .where(
          and(
            eq(generation_runs.type, "module"),
            inArray(generation_runs.status, ["queued", "processing"]),
            this.dispatchCursor ? gt(generation_runs.id, this.dispatchCursor) : undefined,
          ),
        )
        .orderBy(asc(generation_runs.id))
        .limit(25);

      for (const run of runs) await this.dispatchRun(run);
      this.dispatchCursor = runs.length === 25 ? runs.at(-1)?.generationRunId : undefined;
    } catch (error) {
      console.error(
        JSON.stringify({
          level: "error",
          event: "generation.dispatch_poll_failed",
          errorType: error instanceof Error ? error.name : "UnknownError",
        }),
      );
    } finally {
      this.polling = false;
    }
  }

  private async dispatchRun(run: QueuedRun): Promise<void> {
    const payload: ModuleGenerationJob = run;
    try {
      const outcome = await this.infrastructure.ensureJob({
        queue: this.infrastructure.moduleGenerationQueue,
        name: "generate-module",
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
          event: "generation.dispatched",
          runId: run.generationRunId,
          moduleId: run.moduleId,
          outcome,
        }),
      );
    } catch (error) {
      console.error(
        JSON.stringify({
          level: "error",
          event: "generation.dispatch_failed",
          runId: run.generationRunId,
          errorType: error instanceof Error ? error.name : "UnknownError",
        }),
      );
    }
  }
}
