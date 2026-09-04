import { createHash, randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import type {
  CreateModuleBody,
  CreateModuleResponse,
  GenerationFailure,
  GenerationPhase,
  GenerationStatus,
  ListModulesQuery,
  ListModulesResponse,
  ModuleSummary,
} from "@ngertiin/contracts/api";
import { generationFailureSchema, timestampSchema, uuidSchema } from "@ngertiin/contracts/api";
import { MODULE_GENERATION_STEPS } from "@ngertiin/contracts/jobs";
import {
  type DatabaseTransaction,
  generation_request_sources,
  generation_requests,
  generation_run_steps,
  generation_runs,
  module_nodes,
  modules,
  node_progress,
  sources,
  user_module_progress,
} from "@ngertiin/database";
import { and, asc, desc, eq, inArray, lt, or, type SQL, sql } from "drizzle-orm";
import { z } from "zod";
import { ProductError } from "../http/product-error.js";
import { IdempotencyService } from "../idempotency/idempotency.service.js";
import { InfrastructureService } from "../infrastructure/infrastructure.service.js";

const moduleCursorSchema = z
  .object({
    updatedAt: timestampSchema,
    id: uuidSchema,
  })
  .strict();

const sourceMetadataSchema = z
  .object({ page_count: z.number().int().nonnegative().optional() })
  .loose();

const fallbackGenerationFailure: GenerationFailure = {
  code: "GENERATION_FAILED",
  message: "Module generation could not be completed.",
  retryable: true,
};

function readGenerationFailure(value: unknown): GenerationFailure {
  const parsed = generationFailureSchema.safeParse(value);
  return parsed.success ? parsed.data : fallbackGenerationFailure;
}

type ModuleRow = {
  id: string;
  title: string | null;
  description: string | null;
  difficulty: "beginner" | "intermediate" | "advanced" | null;
  status: "generating" | "ready" | "failed" | "archived";
  estimatedMinutes: number | null;
  createdAt: Date;
  updatedAt: Date;
  progressStatus: "not_started" | "in_progress" | "completed" | null;
  progressPercentage: string | null;
  currentNodeId: string | null;
};

type GenerationStepRow = {
  step: string;
  status: "pending" | "processing" | "completed" | "failed";
};

function findCurrentStep(
  runStatus: GenerationStatus["state"],
  steps: GenerationStepRow[],
): GenerationStepRow | undefined {
  if (runStatus === "processing") {
    return (
      steps.find((step) => step.status === "processing") ??
      steps.find((step) => step.status === "pending")
    );
  }
  if (runStatus === "failed") return steps.find((step) => step.status === "failed");
  return undefined;
}

@Injectable()
export class ModulesService {
  constructor(
    @Inject(InfrastructureService) private readonly infrastructure: InfrastructureService,
    @Inject(IdempotencyService) private readonly idempotency: IdempotencyService,
  ) {}

  async createModule(
    userId: string,
    key: string,
    input: CreateModuleBody,
  ): Promise<{ status: number; body: CreateModuleResponse }> {
    const sourcesByPriority = input.sources
      .map((source) => ({
        sourceId: source.sourceId,
        role: source.role,
        priority: source.priority,
        ...(source.selector ? { selector: source.selector } : {}),
      }))
      .sort(
        (left, right) =>
          left.priority - right.priority || left.sourceId.localeCompare(right.sourceId),
      );
    const payloadHash = createHash("sha256")
      .update(JSON.stringify({ instruction: input.instruction, sources: sourcesByPriority }))
      .digest("hex");

    return this.idempotency.execute(
      { userId, method: "POST", route: "/api/v1/modules", key, payloadHash },
      async (transaction) => {
        const requestedSourceIds = input.sources.map((source) => source.sourceId);
        const ownedSources = await transaction
          .select({
            id: sources.id,
            type: sources.type,
            status: sources.status,
            metadata: sources.metadata,
          })
          .from(sources)
          .where(and(eq(sources.user_id, userId), inArray(sources.id, requestedSourceIds)))
          .orderBy(asc(sources.id))
          .for("share");

        if (ownedSources.length !== requestedSourceIds.length) {
          throw new ProductError(
            404,
            "NOT_FOUND",
            "Resource not found",
            "The requested resource was not found.",
          );
        }

        const sourceById = new Map(ownedSources.map((source) => [source.id, source]));
        for (const [index, selected] of input.sources.entries()) {
          const source = sourceById.get(selected.sourceId);
          if (!source) {
            throw new ProductError(
              404,
              "NOT_FOUND",
              "Resource not found",
              "The requested resource was not found.",
            );
          }
          if (source.status === "failed") {
            throw new ProductError(
              409,
              "SOURCE_PROCESSING_FAILED",
              "Source processing failed",
              "A selected Source could not be processed.",
            );
          }
          if (source.status !== "ready") {
            throw new ProductError(
              409,
              "SOURCE_NOT_READY",
              "Source is not ready",
              "Every selected Source must be ready before generation starts.",
            );
          }
          if (selected.selector) {
            const metadata = sourceMetadataSchema.safeParse(source.metadata);
            const pageCount = metadata.success ? metadata.data.page_count : undefined;
            if (source.type !== "pdf") {
              throw new ProductError(
                422,
                "VALIDATION_ERROR",
                "Request validation failed",
                "Page selectors can only be used with PDF Sources.",
                [
                  {
                    path: `sources.${index}.selector`,
                    code: "selector_not_allowed",
                    message: "Page selectors can only be used with PDF Sources.",
                  },
                ],
              );
            }
            if (pageCount === undefined || selected.selector.pages.to > pageCount) {
              throw new ProductError(
                422,
                "VALIDATION_ERROR",
                "Request validation failed",
                "The selected page range exceeds the PDF page count.",
                [
                  {
                    path: `sources.${index}.selector.pages.to`,
                    code: "page_range_out_of_bounds",
                    message: `Page range must end at or before page ${pageCount ?? 0}.`,
                  },
                ],
              );
            }
          }
        }

        const now = new Date();
        const generationRequestId = randomUUID();
        const moduleId = randomUUID();
        await transaction.insert(generation_requests).values({
          id: generationRequestId,
          user_id: userId,
          instruction: input.instruction,
          created_at: now,
        });
        await transaction.insert(generation_request_sources).values(
          input.sources.map((source) => ({
            generation_request_id: generationRequestId,
            source_id: source.sourceId,
            role: source.role,
            priority: source.priority,
            selector: source.selector ?? null,
            created_at: now,
          })),
        );
        await transaction.insert(modules).values({
          id: moduleId,
          owner_id: userId,
          generation_request_id: generationRequestId,
          title: null,
          status: "generating",
          created_at: now,
          updated_at: now,
        });
        await this.queueGenerationRun(transaction, {
          userId,
          moduleId,
          generationRequestId,
          createdAt: now,
        });
        return {
          status: 202,
          body: {
            data: {
              module: {
                id: moduleId,
                title: null,
                description: null,
                difficulty: null,
                status: "generating",
                estimatedMinutes: null,
                progress: null,
                nextAction: { type: "wait_for_module", moduleId },
                createdAt: now.toISOString(),
                updatedAt: now.toISOString(),
              },
              generation: {
                state: "queued",
                progressPercentage: 0,
                currentPhase: null,
                phases: [],
                failure: null,
                startedAt: null,
                finishedAt: null,
              },
            },
          },
        };
      },
    );
  }

  async listModules(userId: string, query: ListModulesQuery): Promise<ListModulesResponse> {
    const filters: SQL[] = [eq(modules.owner_id, userId)];
    if (query.status) {
      filters.push(inArray(modules.status, query.status));
    } else {
      filters.push(sql`${modules.status} <> 'archived'`);
    }
    if (query.progressStatus) {
      filters.push(eq(user_module_progress.status, query.progressStatus));
    }
    if (query.cursor !== undefined) {
      let cursor: z.infer<typeof moduleCursorSchema>;
      try {
        if (query.cursor.length > 512 || !/^[A-Za-z0-9_-]+$/.test(query.cursor)) {
          throw new Error("Invalid base64url cursor");
        }
        const decoded = Buffer.from(query.cursor, "base64url").toString("utf8");
        if (Buffer.from(decoded).toString("base64url") !== query.cursor) {
          throw new Error("Non-canonical base64url cursor");
        }
        cursor = moduleCursorSchema.parse(JSON.parse(decoded));
      } catch {
        throw new ProductError(
          400,
          "VALIDATION_ERROR",
          "Invalid cursor",
          "The pagination cursor is invalid.",
        );
      }
      const updatedAt = new Date(cursor.updatedAt);
      filters.push(
        or(
          lt(modules.updated_at, updatedAt),
          and(eq(modules.updated_at, updatedAt), lt(modules.id, cursor.id)),
        ) as SQL,
      );
    }

    const rows: ModuleRow[] = await this.infrastructure.database.db
      .select({
        id: modules.id,
        title: modules.title,
        description: modules.description,
        difficulty: modules.difficulty,
        status: modules.status,
        estimatedMinutes: modules.estimated_minutes,
        createdAt: modules.created_at,
        updatedAt: modules.updated_at,
        progressStatus: user_module_progress.status,
        progressPercentage: user_module_progress.progress_percentage,
        currentNodeId: user_module_progress.current_node_id,
      })
      .from(modules)
      .leftJoin(
        user_module_progress,
        and(
          eq(user_module_progress.module_id, modules.id),
          eq(user_module_progress.user_id, userId),
        ),
      )
      .where(and(...filters))
      .orderBy(desc(modules.updated_at), desc(modules.id))
      .limit(query.limit + 1);
    const hasNextPage = rows.length > query.limit;
    const page = await this.readSummaries(userId, rows.slice(0, query.limit));
    const lastModule = page.at(-1);

    return {
      data: page,
      pageInfo: {
        hasNextPage,
        nextCursor:
          hasNextPage && lastModule
            ? Buffer.from(
                JSON.stringify({ updatedAt: lastModule.updatedAt, id: lastModule.id }),
              ).toString("base64url")
            : null,
      },
    };
  }

  async getModule(userId: string, moduleId: string): Promise<ModuleSummary> {
    const [row] = await this.infrastructure.database.db
      .select({
        id: modules.id,
        title: modules.title,
        description: modules.description,
        difficulty: modules.difficulty,
        status: modules.status,
        estimatedMinutes: modules.estimated_minutes,
        createdAt: modules.created_at,
        updatedAt: modules.updated_at,
        progressStatus: user_module_progress.status,
        progressPercentage: user_module_progress.progress_percentage,
        currentNodeId: user_module_progress.current_node_id,
      })
      .from(modules)
      .leftJoin(
        user_module_progress,
        and(
          eq(user_module_progress.module_id, modules.id),
          eq(user_module_progress.user_id, userId),
        ),
      )
      .where(and(eq(modules.id, moduleId), eq(modules.owner_id, userId)))
      .limit(1);
    if (!row) {
      throw new ProductError(
        404,
        "NOT_FOUND",
        "Resource not found",
        "The requested resource was not found.",
      );
    }
    const [summary] = await this.readSummaries(userId, [row]);
    if (!summary) {
      throw new ProductError(
        404,
        "NOT_FOUND",
        "Resource not found",
        "The requested resource was not found.",
      );
    }
    return summary;
  }

  async getGeneration(userId: string, moduleId: string): Promise<GenerationStatus> {
    const [ownedModule] = await this.infrastructure.database.db
      .select({ id: modules.id })
      .from(modules)
      .where(and(eq(modules.id, moduleId), eq(modules.owner_id, userId)))
      .limit(1);
    if (!ownedModule) {
      throw new ProductError(
        404,
        "NOT_FOUND",
        "Resource not found",
        "The requested resource was not found.",
      );
    }
    const [run] = await this.infrastructure.database.db
      .select({
        id: generation_runs.id,
        status: generation_runs.status,
        progressPercentage: generation_runs.progress_percentage,
        error: generation_runs.error,
        startedAt: generation_runs.started_at,
        finishedAt: generation_runs.finished_at,
      })
      .from(generation_runs)
      .where(and(eq(generation_runs.module_id, moduleId), eq(generation_runs.type, "module")))
      .orderBy(desc(generation_runs.created_at), desc(generation_runs.id))
      .limit(1);
    if (!run) {
      throw new ProductError(
        409,
        "GENERATION_NOT_AVAILABLE",
        "Generation is not available",
        "This Module has no generation state.",
      );
    }

    const steps = await this.infrastructure.database.db
      .select({ step: generation_run_steps.step, status: generation_run_steps.status })
      .from(generation_run_steps)
      .where(eq(generation_run_steps.generation_run_id, run.id))
      .orderBy(asc(generation_run_steps.position));
    const phaseByStep = new Map<string, GenerationPhase>(
      MODULE_GENERATION_STEPS.map(({ name, phase }) => [name, phase]),
    );
    const currentStep = findCurrentStep(run.status, steps);

    return {
      state: run.status,
      progressPercentage: run.progressPercentage,
      currentPhase: currentStep ? (phaseByStep.get(currentStep.step) ?? null) : null,
      phases: steps.flatMap((step) => {
        const phase = phaseByStep.get(step.step);
        return phase ? [{ phase, status: step.status }] : [];
      }),
      failure: run.status === "failed" ? readGenerationFailure(run.error) : null,
      startedAt: run.startedAt?.toISOString() ?? null,
      finishedAt: run.finishedAt?.toISOString() ?? null,
    };
  }

  async retryGeneration(
    userId: string,
    moduleId: string,
    key: string,
  ): Promise<{ status: number; body: CreateModuleResponse }> {
    const route = `/api/v1/modules/${moduleId}/generation/retry`;
    const payloadHash = createHash("sha256").update("{}").digest("hex");
    return this.idempotency.execute(
      { userId, method: "POST", route, key, payloadHash },
      async (transaction) => {
        const [module] = await transaction
          .select({
            id: modules.id,
            generationRequestId: modules.generation_request_id,
            title: modules.title,
            description: modules.description,
            difficulty: modules.difficulty,
            estimatedMinutes: modules.estimated_minutes,
            status: modules.status,
            createdAt: modules.created_at,
          })
          .from(modules)
          .where(and(eq(modules.id, moduleId), eq(modules.owner_id, userId)))
          .for("update")
          .limit(1);

        if (!module) {
          throw new ProductError(
            404,
            "NOT_FOUND",
            "Resource not found",
            "The requested resource was not found.",
          );
        }

        const [latestRun] = await transaction
          .select({ status: generation_runs.status, error: generation_runs.error })
          .from(generation_runs)
          .where(and(eq(generation_runs.module_id, moduleId), eq(generation_runs.type, "module")))
          .orderBy(desc(generation_runs.created_at), desc(generation_runs.id))
          .limit(1);
        const failure =
          latestRun?.status === "failed" ? readGenerationFailure(latestRun.error) : null;
        if (
          module.status !== "failed" ||
          latestRun?.status !== "failed" ||
          failure?.retryable !== true
        ) {
          throw new ProductError(
            409,
            "GENERATION_RETRY_NOT_ALLOWED",
            "Generation retry is not allowed",
            "Only the latest retryable failed generation can be retried.",
          );
        }

        const now = new Date();
        await this.queueGenerationRun(transaction, {
          userId,
          moduleId,
          generationRequestId: module.generationRequestId,
          createdAt: now,
        });
        await transaction
          .update(modules)
          .set({ status: "generating", updated_at: now })
          .where(eq(modules.id, moduleId));

        return {
          status: 202,
          body: {
            data: {
              module: {
                id: module.id,
                title: module.title,
                description: module.description,
                difficulty: module.difficulty,
                status: "generating",
                estimatedMinutes: module.estimatedMinutes,
                progress: null,
                nextAction: { type: "wait_for_module", moduleId: module.id },
                createdAt: module.createdAt.toISOString(),
                updatedAt: now.toISOString(),
              },
              generation: {
                state: "queued",
                progressPercentage: 0,
                currentPhase: null,
                phases: [],
                failure: null,
                startedAt: null,
                finishedAt: null,
              },
            },
          },
        };
      },
    );
  }

  private async readSummaries(userId: string, rows: ModuleRow[]): Promise<ModuleSummary[]> {
    if (rows.length === 0) return [];

    const moduleIds = rows.map((row) => row.id);
    const failedModuleIds = rows.filter((row) => row.status === "failed").map((row) => row.id);
    const [nodes, latestFailures] = await Promise.all([
      this.infrastructure.database.db
        .select({
          moduleId: module_nodes.module_id,
          id: module_nodes.id,
          status: node_progress.status,
        })
        .from(module_nodes)
        .leftJoin(
          node_progress,
          and(eq(node_progress.node_id, module_nodes.id), eq(node_progress.user_id, userId)),
        )
        .where(and(inArray(module_nodes.module_id, moduleIds), eq(module_nodes.origin, "core")))
        .orderBy(asc(module_nodes.module_id), asc(module_nodes.core_position)),
      failedModuleIds.length > 0
        ? this.infrastructure.database.db
            .selectDistinctOn([generation_runs.module_id], {
              moduleId: generation_runs.module_id,
              error: generation_runs.error,
            })
            .from(generation_runs)
            .where(
              and(
                inArray(generation_runs.module_id, failedModuleIds),
                eq(generation_runs.type, "module"),
              ),
            )
            .orderBy(
              generation_runs.module_id,
              desc(generation_runs.created_at),
              desc(generation_runs.id),
            )
        : Promise.resolve([]),
    ]);

    const nodesByModule = new Map<string, typeof nodes>();
    for (const node of nodes) {
      const grouped = nodesByModule.get(node.moduleId) ?? [];
      grouped.push(node);
      nodesByModule.set(node.moduleId, grouped);
    }
    const failureByModule = new Map(
      latestFailures.map((run) => [run.moduleId, readGenerationFailure(run.error)]),
    );

    return rows.map((row) => {
      const moduleNodes = nodesByModule.get(row.id) ?? [];
      const progress = row.progressStatus
        ? {
            status: row.progressStatus,
            percentage: Number(row.progressPercentage ?? 0),
            completedCoreNodes: moduleNodes.filter((node) => node.status === "completed").length,
            totalCoreNodes: moduleNodes.length,
          }
        : null;

      let nextAction: ModuleSummary["nextAction"];
      if (row.status === "generating") {
        nextAction = { type: "wait_for_module", moduleId: row.id };
      } else if (row.status === "failed") {
        if (failureByModule.get(row.id)?.retryable === true) {
          nextAction = { type: "retry_module", moduleId: row.id };
        } else {
          nextAction = { type: "none" };
        }
      } else if (row.status === "archived") {
        nextAction = { type: "none" };
      } else if (row.progressStatus === "completed") {
        nextAction = { type: "module_completed", moduleId: row.id };
      } else {
        const activeNode =
          moduleNodes.find(
            (node) => node.id === row.currentNodeId && node.status === "in_progress",
          ) ??
          moduleNodes.find((node) => node.status === "in_progress" || node.status === "available");
        if (activeNode) {
          const type = activeNode.status === "in_progress" ? "resume_core_node" : "start_core_node";
          nextAction = { type, moduleId: row.id, nodeId: activeNode.id };
        } else {
          nextAction = { type: "none" };
        }
      }

      return {
        id: row.id,
        title: row.title,
        description: row.description,
        difficulty: row.difficulty,
        status: row.status,
        estimatedMinutes: row.estimatedMinutes,
        progress,
        nextAction,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      };
    });
  }

  private async queueGenerationRun(
    transaction: DatabaseTransaction,
    input: {
      userId: string;
      moduleId: string;
      generationRequestId: string;
      createdAt: Date;
    },
  ): Promise<void> {
    const generationRunId = randomUUID();
    await transaction.insert(generation_runs).values({
      id: generationRunId,
      user_id: input.userId,
      module_id: input.moduleId,
      generation_request_id: input.generationRequestId,
      type: "module",
      status: "queued",
      progress_percentage: 0,
      created_at: input.createdAt,
    });
    await transaction.insert(generation_run_steps).values(
      MODULE_GENERATION_STEPS.map(({ name }, position) => ({
        generation_run_id: generationRunId,
        step: name,
        position: position + 1,
        status: "pending" as const,
      })),
    );
  }
}
