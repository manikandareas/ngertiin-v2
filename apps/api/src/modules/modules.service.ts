import { createHash, randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import type {
  CompleteNodeResult,
  CreateModuleBody,
  CreateModuleResponse,
  GenerationFailure,
  GenerationPhase,
  GenerationStatus,
  JourneyNode,
  JourneySummary,
  ListModulesQuery,
  ListModulesResponse,
  ModuleSummary,
  NextLearningAction,
  NodeActionResult,
  NodeDetail,
  NodeProgress,
  PublicActivity,
} from "@ngertiin/contracts/api";
import {
  generationFailureSchema,
  markdownLessonContentSchema,
  publicActivitySchema,
  timestampSchema,
  uuidSchema,
} from "@ngertiin/contracts/api";
import { MODULE_GENERATION_STEPS } from "@ngertiin/contracts/jobs";
import {
  activities,
  adaptive_interventions,
  attempts,
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
import {
  finalizeAdaptiveNodeProgress,
  finalizeCoreNodeProgress,
  selectLearningAction,
} from "@ngertiin/shared";
import { and, asc, desc, eq, ilike, inArray, lt, or, type SQL, sql } from "drizzle-orm";
import { z } from "zod";
import { ProductError } from "../http/product-error.js";
import { IdempotencyService } from "../idempotency/idempotency.service.js";
import { InfrastructureService } from "../infrastructure/infrastructure.service.js";
import { UsageService } from "../usage/usage.service.js";
import { moduleRunCount, retriesRemaining } from "../usage/usage-policy.js";

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

type ProgressNodeRow = {
  id: string;
  origin: "core" | "adaptive";
  type: "lesson" | "flashcard" | "quiz" | "checkpoint" | "review" | "practice" | "remedial_quiz";
  title: string;
  description: string | null;
  position: number;
  interventionId: string | null;
  status: "locked" | "available" | "in_progress" | "completed";
  bestScore: string | null;
  attemptCount: number;
};

function mapNodeProgress(
  row: Pick<ProgressNodeRow, "status" | "bestScore" | "attemptCount">,
): NodeProgress {
  return {
    status: row.status,
    bestScore: row.bestScore === null ? null : Number(row.bestScore),
    attemptCount: row.attemptCount,
  };
}

function mapJourneyNode(row: ProgressNodeRow): JourneyNode {
  return {
    id: row.id,
    origin: row.origin,
    type: row.type,
    title: row.title,
    description: row.description,
    position: row.position,
    progress: mapNodeProgress(row),
    ...(row.interventionId ? { interventionId: row.interventionId } : {}),
  };
}

function selectNextAction(input: {
  moduleId: string;
  moduleStatus: ModuleRow["status"];
  progressStatus: ModuleRow["progressStatus"];
  currentNodeId: string | null;
  nodes: Array<Pick<ProgressNodeRow, "id" | "status">>;
}): NextLearningAction {
  if (input.moduleStatus === "archived") return { type: "none" };
  const activeNode =
    input.nodes.find(
      (node) =>
        node.id === input.currentNodeId &&
        (node.status === "in_progress" || node.status === "available"),
    ) ??
    input.nodes.find((node) => node.status === "in_progress") ??
    input.nodes.find((node) => node.status === "available");
  return selectLearningAction({
    moduleId: input.moduleId,
    moduleStatus: input.moduleStatus,
    moduleProgressStatus: input.progressStatus,
    currentCoreNodeId: activeNode?.id ?? input.currentNodeId,
    currentCoreNodeStatus: activeNode?.status,
  });
}

function mapModuleProgress(
  status: "not_started" | "in_progress" | "completed",
  storedPercentage: string,
  nodes: Array<Pick<ProgressNodeRow, "status">>,
): JourneySummary["progress"] {
  return {
    status,
    percentage: Number(storedPercentage),
    completedCoreNodes: nodes.filter((node) => node.status === "completed").length,
    totalCoreNodes: nodes.length,
  };
}

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
    @Inject(UsageService) private readonly usage: UsageService,
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
      .update(
        JSON.stringify({
          instruction: input.instruction,
          sources: sourcesByPriority,
          generationSettings: input.generationSettings,
        }),
      )
      .digest("hex");

    return this.idempotency.execute(
      { userId, method: "POST", route: "/api/v1/modules", key, payloadHash },
      async (transaction) => {
        await this.usage.lock(transaction, userId);
        const requestedSourceIds = input.sources.map((source) => source.sourceId);
        const ownedSources = await transaction
          .select({
            id: sources.id,
            type: sources.type,
            status: sources.status,
            archivedAt: sources.archived_at,
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
          if (source.archivedAt)
            throw new ProductError(
              409,
              "VALIDATION_ERROR",
              "Source archived",
              "Pulihkan atau lepaskan materi arsip sebelum membuat modul baru.",
            );
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

        const now = await this.usage.assertQuota(transaction, userId, "modules");
        await this.usage.assertSlot(transaction, userId);
        const generationRequestId = randomUUID();
        const moduleId = randomUUID();
        await transaction.insert(generation_requests).values({
          id: generationRequestId,
          user_id: userId,
          instruction: input.instruction,
          generation_settings: input.generationSettings,
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
                retriesRemaining: 2,
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
    if (query.q) {
      const pattern = `%${query.q.replace(/[\\%_]/g, "\\$&")}%`;
      filters.push(or(ilike(modules.title, pattern), ilike(modules.description, pattern)) as SQL);
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

  async getDashboardModules(userId: string): Promise<{
    continueLearning: { module: ModuleSummary } | null;
    modules: ModuleSummary[];
  }> {
    const priority = sql<number>`case
      when ${modules.status} = 'ready' and ${user_module_progress.status} = 'in_progress' then 1
      when ${modules.status} = 'ready' and ${user_module_progress.status} = 'not_started' then 2
      when ${modules.status} = 'generating' then 3
      else 4
    end`;
    const selectFields = {
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
    };
    const baseJoin = and(
      eq(user_module_progress.module_id, modules.id),
      eq(user_module_progress.user_id, userId),
    );

    const [candidateRows, previewRows] = await Promise.all([
      this.infrastructure.database.db
        .select(selectFields)
        .from(modules)
        .leftJoin(user_module_progress, baseJoin)
        .where(
          and(
            eq(modules.owner_id, userId),
            sql`${modules.status} <> 'archived'`,
            sql`${priority} < 4`,
          ),
        )
        .orderBy(
          priority,
          sql`case when ${priority} = 1 then ${user_module_progress.updated_at} end desc`,
          sql`case when ${priority} in (2, 3) then ${modules.created_at} end desc`,
          desc(modules.updated_at),
          desc(modules.id),
        )
        .limit(1),
      this.infrastructure.database.db
        .select(selectFields)
        .from(modules)
        .leftJoin(user_module_progress, baseJoin)
        .where(and(eq(modules.owner_id, userId), sql`${modules.status} <> 'archived'`))
        .orderBy(desc(modules.updated_at), desc(modules.id))
        .limit(6),
    ]);

    const candidate = candidateRows[0];
    const mergedRows = [
      ...(candidate ? [candidate] : []),
      ...previewRows.filter((row) => row.id !== candidate?.id),
    ] as ModuleRow[];
    const summaries = await this.readSummaries(userId, mergedRows);
    const byId = new Map(summaries.map((summary) => [summary.id, summary]));
    const candidateSummary = candidate ? byId.get(candidate.id) : undefined;

    return {
      continueLearning: candidateSummary ? { module: candidateSummary } : null,
      modules: previewRows.flatMap((row) => {
        const summary = byId.get(row.id);
        return summary ? [summary] : [];
      }),
    };
  }

  async archiveModule(userId: string, moduleId: string): Promise<ModuleSummary> {
    await this.infrastructure.database.db.transaction(async (transaction) => {
      const [module] = await transaction
        .select({ status: modules.status })
        .from(modules)
        .where(and(eq(modules.id, moduleId), eq(modules.owner_id, userId)))
        .for("update")
        .limit(1);
      if (!module) this.notFound();
      if (module.status === "archived") return;
      if (module.status !== "ready") {
        throw new ProductError(
          409,
          "MODULE_ARCHIVE_NOT_ALLOWED",
          "Module cannot be archived",
          "Only a ready Module can be archived.",
        );
      }
      await transaction
        .update(modules)
        .set({ status: "archived", updated_at: new Date() })
        .where(eq(modules.id, moduleId));
    });
    return this.getModule(userId, moduleId);
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

  async getJourney(userId: string, moduleId: string): Promise<JourneySummary> {
    const [module] = await this.infrastructure.database.db
      .select({
        id: modules.id,
        title: modules.title,
        description: modules.description,
        difficulty: modules.difficulty,
        estimatedMinutes: modules.estimated_minutes,
        status: modules.status,
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
    if (!module) this.notFound();
    if (module.status !== "ready" && module.status !== "archived") {
      throw new ProductError(
        409,
        "MODULE_NOT_READY",
        "Module is not ready",
        "The Module journey is not available until generation completes.",
      );
    }
    if (
      !module.title ||
      !module.difficulty ||
      !module.progressStatus ||
      module.progressPercentage === null
    ) {
      throw new Error("Ready Module is missing initialized learning state.");
    }

    const rows: ProgressNodeRow[] = (await this.infrastructure.database.db
      .select({
        id: module_nodes.id,
        origin: module_nodes.origin,
        type: module_nodes.type,
        title: module_nodes.title,
        description: module_nodes.description,
        position: sql<number>`coalesce(${module_nodes.core_position}, ${module_nodes.adaptive_position})`,
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
      .where(eq(module_nodes.module_id, moduleId))
      .orderBy(asc(module_nodes.created_at), asc(module_nodes.id))) as ProgressNodeRow[];

    const interventions = await this.infrastructure.database.db
      .select({
        id: adaptive_interventions.id,
        triggerNodeId: adaptive_interventions.trigger_node_id,
        triggerAttemptId: adaptive_interventions.trigger_attempt_id,
        status: adaptive_interventions.status,
        createdAt: adaptive_interventions.created_at,
      })
      .from(adaptive_interventions)
      .where(
        and(
          eq(adaptive_interventions.user_id, userId),
          eq(adaptive_interventions.module_id, moduleId),
        ),
      )
      .orderBy(asc(adaptive_interventions.created_at));
    const coreRows = rows
      .filter((node) => node.origin === "core")
      .sort((a, b) => a.position - b.position);
    const adaptiveByTrigger = new Map<string, ProgressNodeRow[]>();
    for (const intervention of interventions) {
      const existing = adaptiveByTrigger.get(intervention.triggerNodeId) ?? [];
      adaptiveByTrigger.set(intervention.triggerNodeId, [
        ...existing,
        ...rows
          .filter((node) => node.interventionId === intervention.id)
          .sort((a, b) => a.position - b.position),
      ]);
    }
    const displayRows = coreRows.flatMap((node) => [
      node,
      ...(adaptiveByTrigger.get(node.id) ?? []),
    ]);

    return {
      module: {
        id: module.id,
        title: module.title,
        description: module.description,
        difficulty: module.difficulty,
        estimatedMinutes: module.estimatedMinutes,
      },
      progress: mapModuleProgress(module.progressStatus, module.progressPercentage, coreRows),
      nodes: displayRows.map(mapJourneyNode),
      nextAction: selectNextAction({
        moduleId,
        moduleStatus: module.status,
        progressStatus: module.progressStatus,
        currentNodeId: module.currentNodeId,
        nodes: coreRows,
      }),
    };
  }

  /** Validate chat page metadata without loading activity bodies or assessment config. */
  async validateChatScope(userId: string, moduleId: string, nodeId?: string): Promise<void> {
    const [module] = await this.infrastructure.database.db
      .select({ id: modules.id })
      .from(modules)
      .where(and(eq(modules.id, moduleId), eq(modules.owner_id, userId)))
      .limit(1);
    if (!module) this.notFound();
    if (!nodeId) return;
    const [node] = await this.infrastructure.database.db
      .select({ status: node_progress.status })
      .from(module_nodes)
      .leftJoin(
        node_progress,
        and(eq(node_progress.node_id, module_nodes.id), eq(node_progress.user_id, userId)),
      )
      .where(and(eq(module_nodes.id, nodeId), eq(module_nodes.module_id, moduleId)))
      .limit(1);
    if (!node) this.notFound();
    if (!node.status || node.status === "locked")
      throw new ProductError(403, "NODE_LOCKED", "Node locked", "Node ini belum dapat diakses.");
  }

  async getNode(userId: string, moduleId: string, nodeId: string): Promise<NodeDetail> {
    const journey = await this.getJourney(userId, moduleId);
    const node = journey.nodes.find((candidate) => candidate.id === nodeId);
    if (!node) this.notFound();
    if (node.progress.status === "locked") {
      throw new ProductError(
        409,
        "NODE_LOCKED",
        "Node is locked",
        "Complete the preceding learning node before opening this content.",
      );
    }

    const [rows, [latestCompletedAttempt]] = await Promise.all([
      this.infrastructure.database.db
        .select({
          id: activities.id,
          type: activities.type,
          position: activities.position,
          content: activities.content,
        })
        .from(activities)
        .where(eq(activities.node_id, nodeId))
        .orderBy(asc(activities.position)),
      this.infrastructure.database.db
        .select({ id: attempts.id })
        .from(attempts)
        .where(
          and(
            eq(attempts.user_id, userId),
            eq(attempts.module_id, moduleId),
            eq(attempts.node_id, nodeId),
            eq(attempts.evaluation_status, "completed"),
          ),
        )
        .orderBy(desc(attempts.attempt_number))
        .limit(1),
    ]);

    return {
      latestCompletedAttemptId: latestCompletedAttempt?.id ?? null,
      node,
      activities: await Promise.all(rows.map((row) => this.mapPublicActivity(row))),
      moduleProgress: journey.progress,
      nextAction: journey.nextAction,
    };
  }

  async startNode(userId: string, moduleId: string, nodeId: string): Promise<NodeActionResult> {
    return this.infrastructure.database.db.transaction(async (transaction) => {
      const module = await this.lockLearnableModule(transaction, userId, moduleId);
      const [moduleProgress] = await transaction
        .select({ id: user_module_progress.id })
        .from(user_module_progress)
        .where(
          and(
            eq(user_module_progress.user_id, userId),
            eq(user_module_progress.module_id, moduleId),
          ),
        )
        .for("update")
        .limit(1);
      if (!moduleProgress) throw new Error("Ready Module is missing Module progress.");

      const [progress] = await transaction
        .select({
          id: node_progress.id,
          status: node_progress.status,
          bestScore: node_progress.best_score,
          attemptCount: node_progress.attempt_count,
          origin: module_nodes.origin,
          interventionId: module_nodes.adaptive_intervention_id,
          triggerAttemptId: adaptive_interventions.trigger_attempt_id,
        })
        .from(node_progress)
        .innerJoin(module_nodes, eq(module_nodes.id, node_progress.node_id))
        .leftJoin(
          adaptive_interventions,
          eq(adaptive_interventions.id, module_nodes.adaptive_intervention_id),
        )
        .where(
          and(
            eq(node_progress.user_id, userId),
            eq(node_progress.node_id, nodeId),
            eq(module_nodes.module_id, moduleId),
          ),
        )
        .for("update", { of: node_progress })
        .limit(1);
      if (!progress) this.notFound();
      if (progress.status === "locked") this.nodeLocked();

      if (progress.status === "available") {
        const now = new Date();
        await transaction
          .update(node_progress)
          .set({ status: "in_progress", started_at: now, updated_at: now })
          .where(eq(node_progress.id, progress.id));
        if (progress.origin === "adaptive" && progress.interventionId) {
          await transaction
            .update(adaptive_interventions)
            .set({ status: "in_progress" })
            .where(eq(adaptive_interventions.id, progress.interventionId));
        } else {
          await transaction
            .update(user_module_progress)
            .set({
              status: "in_progress",
              current_node_id: nodeId,
              started_at: sql`coalesce(${user_module_progress.started_at}, current_timestamp)`,
              updated_at: now,
            })
            .where(eq(user_module_progress.id, moduleProgress.id));
        }
      }

      const state = await this.readProgressState(transaction, userId, moduleId);
      const current = state.nodes.find((node) => node.id === nodeId);
      if (!current) this.notFound();
      const coreNodes = state.nodes.filter((node) => node.origin === "core");
      return {
        nodeProgress: mapNodeProgress(current),
        moduleProgress: mapModuleProgress(
          state.progress.status,
          state.progress.percentage,
          coreNodes,
        ),
        nextAction:
          current.origin === "adaptive" && progress.interventionId && progress.triggerAttemptId
            ? selectLearningAction({
                moduleId,
                moduleStatus: module.status,
                moduleProgressStatus: state.progress.status,
                currentCoreNodeId: state.progress.currentNodeId,
                intervention: {
                  id: progress.interventionId,
                  triggerAttemptId: progress.triggerAttemptId,
                  status: "in_progress",
                  firstNodeId: nodeId,
                  activeNodeId: nodeId,
                },
              })
            : selectNextAction({
                moduleId,
                moduleStatus: module.status,
                progressStatus: state.progress.status,
                currentNodeId: state.progress.currentNodeId,
                nodes: coreNodes,
              }),
      };
    });
  }

  async completeNode(
    userId: string,
    moduleId: string,
    nodeId: string,
  ): Promise<CompleteNodeResult> {
    return this.infrastructure.database.db.transaction(async (transaction) => {
      await this.lockLearnableModule(transaction, userId, moduleId);
      const [progress] = await transaction
        .select({
          status: node_progress.status,
          origin: module_nodes.origin,
        })
        .from(node_progress)
        .innerJoin(module_nodes, eq(module_nodes.id, node_progress.node_id))
        .where(
          and(
            eq(node_progress.user_id, userId),
            eq(node_progress.node_id, nodeId),
            eq(module_nodes.module_id, moduleId),
          ),
        )
        .for("update", { of: node_progress })
        .limit(1);
      if (!progress) this.notFound();
      if (progress.status === "locked") this.nodeLocked();

      const activityTypes = await transaction
        .select({ type: activities.type })
        .from(activities)
        .where(eq(activities.node_id, nodeId));
      if (
        activityTypes.some(
          ({ type }) =>
            type === "multiple_choice" || type === "true_false" || type === "short_answer",
        )
      ) {
        throw new ProductError(
          409,
          "ATTEMPT_REQUIRED",
          "Assessment attempt required",
          "This node contains assessment activities and must be completed through an Attempt.",
        );
      }
      return progress.origin === "adaptive"
        ? finalizeAdaptiveNodeProgress(transaction, { userId, moduleId, nodeId })
        : finalizeCoreNodeProgress(transaction, {
            userId,
            moduleId,
            nodeId,
            xp: { amount: 10, reason: "node_completed" },
          });
    });
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
        runCount: moduleRunCount,
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
      retriesRemaining: retriesRemaining(run.runCount),
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
        await this.usage.lock(transaction, userId);
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

        const remaining = await this.usage.assertRetry(transaction, "modules", moduleId);
        await this.usage.assertSlot(transaction, userId);
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
                retriesRemaining: remaining,
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
              runCount: moduleRunCount,
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
    const remainingByModule = new Map(
      latestFailures.map((run) => [run.moduleId, retriesRemaining(run.runCount)]),
    );
    const active = failedModuleIds.length ? (await this.usage.read(userId)).activeModuleId : null;
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
      if (row.status === "failed") {
        if (
          failureByModule.get(row.id)?.retryable === true &&
          (remainingByModule.get(row.id) ?? 0) > 0 &&
          !active
        ) {
          nextAction = { type: "retry_module", moduleId: row.id };
        } else {
          nextAction = { type: "none" };
        }
      } else {
        nextAction = selectNextAction({
          moduleId: row.id,
          moduleStatus: row.status,
          progressStatus: row.progressStatus,
          currentNodeId: row.currentNodeId,
          nodes: moduleNodes.flatMap((node) =>
            node.status ? [{ id: node.id, status: node.status }] : [],
          ),
        });
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

  private async lockLearnableModule(
    transaction: DatabaseTransaction,
    userId: string,
    moduleId: string,
  ): Promise<{ status: "ready" }> {
    const [module] = await transaction
      .select({ status: modules.status })
      .from(modules)
      .where(and(eq(modules.id, moduleId), eq(modules.owner_id, userId)))
      .for("update")
      .limit(1);
    if (!module) this.notFound();
    if (module.status !== "ready") {
      throw new ProductError(
        409,
        "MODULE_NOT_LEARNABLE",
        "Module is not learnable",
        "Only a ready Module accepts learning progress changes.",
      );
    }
    return { status: module.status };
  }

  private async readProgressState(
    transaction: DatabaseTransaction,
    userId: string,
    moduleId: string,
  ): Promise<{
    progress: {
      status: "not_started" | "in_progress" | "completed";
      percentage: string;
      currentNodeId: string | null;
    };
    nodes: ProgressNodeRow[];
  }> {
    const [progress] = await transaction
      .select({
        status: user_module_progress.status,
        percentage: user_module_progress.progress_percentage,
        currentNodeId: user_module_progress.current_node_id,
      })
      .from(user_module_progress)
      .where(
        and(eq(user_module_progress.user_id, userId), eq(user_module_progress.module_id, moduleId)),
      )
      .limit(1);
    if (!progress) throw new Error("Ready Module is missing Module progress.");
    const nodes = (await transaction
      .select({
        id: module_nodes.id,
        origin: module_nodes.origin,
        type: module_nodes.type,
        title: module_nodes.title,
        description: module_nodes.description,
        position: sql<number>`coalesce(${module_nodes.core_position}, ${module_nodes.adaptive_position})`,
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
      .where(eq(module_nodes.module_id, moduleId))
      .orderBy(asc(module_nodes.created_at), asc(module_nodes.id))) as ProgressNodeRow[];
    return { progress, nodes };
  }

  private async mapPublicActivity(row: {
    id: string;
    type: "lesson" | "flashcard" | "multiple_choice" | "true_false" | "short_answer";
    position: number;
    content: unknown;
  }): Promise<PublicActivity> {
    if (row.type !== "lesson") return publicActivitySchema.parse(row);
    const content = row.content as Record<string, unknown>;
    if (content.format === "markdown") {
      const parsed = markdownLessonContentSchema.parse(content);
      const images = (
        await Promise.all(
          parsed.images.map(async ({ objectKey, ...image }) => {
            try {
              return {
                ...image,
                url: await this.infrastructure.storage.createSignedUrl(objectKey),
              };
            } catch {
              return null;
            }
          }),
        )
      ).filter((image) => image !== null);
      return publicActivitySchema.parse({ ...row, content: { ...parsed, images } });
    }
    return publicActivitySchema.parse({
      id: row.id,
      type: row.type,
      position: row.position,
      content: {
        explanation: content.explanation,
        keyPoints: content.keyPoints,
        ...(typeof content.introduction === "string" ? { introduction: content.introduction } : {}),
        ...(Array.isArray(content.examples) ? { examples: content.examples } : {}),
        ...(typeof content.summary === "string" ? { summary: content.summary } : {}),
      },
    });
  }

  private notFound(): never {
    throw new ProductError(
      404,
      "NOT_FOUND",
      "Resource not found",
      "The requested resource was not found.",
    );
  }

  private nodeLocked(): never {
    throw new ProductError(
      409,
      "NODE_LOCKED",
      "Node is locked",
      "Complete the preceding learning node before opening this content.",
    );
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
