import { createHash } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import {
  assessmentFeedbackSchema,
  type AttemptPolicyOutcome,
  type AttemptResult,
  type DeterministicAnswer,
  type NextLearningAction,
  type SubmitAttemptBody,
} from "@ngertiin/contracts/api";
import {
  activities,
  attempt_concept_results,
  attempt_responses,
  attempts,
  module_concepts,
  module_nodes,
  modules,
  node_progress,
  user_module_progress,
} from "@ngertiin/database";
import {
  evaluateDeterministicActivities,
  failAttemptEvaluation,
  finalizeAttemptEvaluation,
  InvalidEvaluationConfigurationError,
  SAFE_NON_RETRYABLE_EVALUATION_FAILURE,
} from "@ngertiin/shared";
import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { ProductError } from "../http/product-error.js";
import { InfrastructureService } from "../infrastructure/infrastructure.service.js";
import { ASSESSMENT_SUBMISSION_ENABLED } from "./assessment-submission.gate.js";

const REQUEST_WAIT_MILLISECONDS = 5_000;
const STATUS_POLL_MILLISECONDS = 250;
const safeEvaluationSchema = z.object({ correct: z.boolean(), explanation: z.string() }).strict();
const safeFailureSchema = z
  .object({
    code: z.literal("ATTEMPT_EVALUATION_FAILED"),
    message: z.string(),
    retryable: z.boolean(),
  })
  .strict();

type ActivityRow = {
  id: string;
  type: "lesson" | "flashcard" | "multiple_choice" | "true_false" | "short_answer";
  content: unknown;
  evaluationConfig: unknown;
};

function isAssessment(
  activity: ActivityRow,
): activity is ActivityRow & { type: "multiple_choice" | "true_false" | "short_answer" } {
  return ["multiple_choice", "true_false", "short_answer"].includes(activity.type);
}

function normalizedSubmissionHash(responses: SubmitAttemptBody["responses"]): string {
  const normalized = responses
    .map(({ activityId, answer }) => ({ activityId, answer }))
    .sort((left, right) => left.activityId.localeCompare(right.activityId));
  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
}

function responseValidationError(detail: string): never {
  throw new ProductError(422, "VALIDATION_ERROR", "Invalid assessment submission", detail);
}

function notFound(): never {
  throw new ProductError(
    404,
    "NOT_FOUND",
    "Resource not found",
    "The requested resource was not found.",
  );
}

@Injectable()
export class AttemptsService {
  constructor(
    @Inject(InfrastructureService) private readonly infrastructure: InfrastructureService,
  ) {}

  async submitAttempt(
    userId: string,
    moduleId: string,
    nodeId: string,
    input: SubmitAttemptBody,
  ): Promise<AttemptResult> {
    await this.assertOwnedNode(userId, moduleId, nodeId);
    if (!ASSESSMENT_SUBMISSION_ENABLED) {
      throw new ProductError(
        409,
        "MODULE_NOT_LEARNABLE",
        "Assessment is not yet learnable",
        "Assessment submission will be available with the adaptive learning flow.",
      );
    }

    const stored = await this.infrastructure.database.db.transaction(async (transaction) => {
      await transaction.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`${userId}:${input.submissionId}`}, 0))`,
      );
      const [progress] = await transaction
        .select({
          id: node_progress.id,
          status: node_progress.status,
          attemptCount: node_progress.attempt_count,
        })
        .from(node_progress)
        .innerJoin(module_nodes, eq(module_nodes.id, node_progress.node_id))
        .where(
          and(
            eq(node_progress.user_id, userId),
            eq(node_progress.node_id, nodeId),
            eq(module_nodes.module_id, moduleId),
            eq(module_nodes.origin, "core"),
          ),
        )
        .for("update", { of: node_progress })
        .limit(1);
      if (!progress) notFound();
      if (progress.status === "locked") {
        throw new ProductError(
          409,
          "NODE_LOCKED",
          "Node is locked",
          "Complete the preceding learning node before submitting this assessment.",
        );
      }

      const activityRows = await transaction
        .select({
          id: activities.id,
          type: activities.type,
          content: activities.content,
          evaluationConfig: activities.evaluation_config,
        })
        .from(activities)
        .where(eq(activities.node_id, nodeId))
        .orderBy(asc(activities.position));
      const assessmentRows = activityRows.filter(isAssessment);
      this.validateSubmission(assessmentRows, input.responses);
      const submissionHash = normalizedSubmissionHash(input.responses);
      const hasShortAnswer = assessmentRows.some(({ type }) => type === "short_answer");

      const [existing] = await transaction
        .select({
          id: attempts.id,
          moduleId: attempts.module_id,
          nodeId: attempts.node_id,
          submissionHash: attempts.submission_hash,
        })
        .from(attempts)
        .where(and(eq(attempts.user_id, userId), eq(attempts.submission_id, input.submissionId)))
        .limit(1);
      if (existing) {
        if (
          existing.moduleId !== moduleId ||
          existing.nodeId !== nodeId ||
          existing.submissionHash !== submissionHash
        ) {
          throw new ProductError(
            409,
            "SUBMISSION_CONFLICT",
            "Submission ID conflict",
            "This submission ID was already used with different responses.",
          );
        }
        return { attemptId: existing.id, hasShortAnswer };
      }

      const [created] = await transaction
        .insert(attempts)
        .values({
          user_id: userId,
          module_id: moduleId,
          node_id: nodeId,
          submission_id: input.submissionId,
          submission_hash: submissionHash,
          attempt_number: progress.attemptCount + 1,
          evaluation_status: "evaluating",
        })
        .returning({ id: attempts.id });
      if (!created) throw new Error("Attempt insert did not return a row.");
      await transaction.insert(attempt_responses).values(
        input.responses.map((response) => ({
          attempt_id: created.id,
          activity_id: response.activityId,
          response: response.answer,
        })),
      );
      await transaction
        .update(node_progress)
        .set({ attempt_count: sql`${node_progress.attempt_count} + 1`, updated_at: new Date() })
        .where(eq(node_progress.id, progress.id));
      return { attemptId: created.id, hasShortAnswer };
    });

    if (stored.hasShortAnswer) await this.waitForTerminalStatus(stored.attemptId);
    else await this.finalizeDeterministicAttempt(stored.attemptId);
    return this.getAttempt(userId, stored.attemptId);
  }

  async getAttempt(userId: string, attemptId: string): Promise<AttemptResult> {
    const [attempt] = await this.infrastructure.database.db
      .select({
        id: attempts.id,
        moduleId: attempts.module_id,
        nodeId: attempts.node_id,
        submissionId: attempts.submission_id,
        attemptNumber: attempts.attempt_number,
        evaluationStatus: attempts.evaluation_status,
        score: attempts.score,
        maxScore: attempts.max_score,
        policyOutcome: attempts.policy_outcome,
        feedback: attempts.feedback,
        xpAwarded: attempts.xp_awarded,
        failure: attempts.failure,
        createdAt: attempts.created_at,
        evaluatedAt: attempts.evaluated_at,
      })
      .from(attempts)
      .where(and(eq(attempts.id, attemptId), eq(attempts.user_id, userId)))
      .limit(1);
    if (!attempt) notFound();

    const progress = await this.readProgress(userId, attempt.moduleId, attempt.nodeId);
    const identity = {
      id: attempt.id,
      submissionId: attempt.submissionId,
      attemptNumber: attempt.attemptNumber,
      createdAt: attempt.createdAt.toISOString(),
    };
    if (attempt.evaluationStatus === "evaluating") {
      return {
        attempt: { ...identity, evaluationStatus: "evaluating" },
        nodeProgress: progress.nodeProgress,
        moduleProgress: progress.moduleProgress,
        xpAwarded: 0,
        nextAction: { type: "none" },
      };
    }
    if (attempt.evaluationStatus === "failed") {
      const failure = safeFailureSchema.safeParse(attempt.failure);
      if (attempt.evaluatedAt === null) {
        throw new Error("Failed Attempt is missing its terminal timestamp.");
      }
      return {
        attempt: {
          ...identity,
          evaluationStatus: "failed",
          failure: failure.success ? failure.data : SAFE_NON_RETRYABLE_EVALUATION_FAILURE,
          evaluatedAt: attempt.evaluatedAt.toISOString(),
        },
        nodeProgress: progress.nodeProgress,
        moduleProgress: progress.moduleProgress,
        xpAwarded: 0,
        nextAction: { type: "none" },
      };
    }

    const [responseRows, conceptRows] = await Promise.all([
      this.infrastructure.database.db
        .select({
          activityId: attempt_responses.activity_id,
          score: attempt_responses.score,
          maxScore: attempt_responses.max_score,
          evaluation: attempt_responses.evaluation,
          position: activities.position,
        })
        .from(attempt_responses)
        .innerJoin(activities, eq(activities.id, attempt_responses.activity_id))
        .where(eq(attempt_responses.attempt_id, attempt.id))
        .orderBy(asc(activities.position)),
      this.infrastructure.database.db
        .select({
          conceptKey: module_concepts.key,
          performanceScore: attempt_concept_results.performance_score,
          masteryScore: attempt_concept_results.mastery_score,
          confidenceScore: attempt_concept_results.confidence_score,
          evidenceCount: attempt_concept_results.evidence_count,
        })
        .from(attempt_concept_results)
        .innerJoin(module_concepts, eq(module_concepts.id, attempt_concept_results.concept_id))
        .where(eq(attempt_concept_results.attempt_id, attempt.id))
        .orderBy(asc(module_concepts.key)),
    ]);
    const activityResults = responseRows.map((row) => {
      const evaluation = safeEvaluationSchema.safeParse(row.evaluation);
      if (!evaluation.success || row.score === null || row.maxScore === null) {
        throw new Error("Completed Attempt has incomplete activity results.");
      }
      return {
        activityId: row.activityId,
        correct: evaluation.data.correct,
        score: Number(row.score),
        maxScore: Number(row.maxScore),
        explanation: evaluation.data.explanation,
      };
    });
    if (
      attempt.score === null ||
      attempt.maxScore === null ||
      attempt.policyOutcome === null ||
      attempt.evaluatedAt === null
    ) {
      throw new Error("Completed Attempt is missing terminal fields.");
    }
    const feedback = assessmentFeedbackSchema.nullable().parse(attempt.feedback);
    const score = Number(attempt.score);
    const maxScore = Number(attempt.maxScore);
    return {
      attempt: {
        ...identity,
        evaluationStatus: "completed",
        score,
        maxScore,
        normalizedScore: score / maxScore,
        activityResults,
        conceptResults: conceptRows.map((row) => ({
          conceptKey: row.conceptKey,
          performanceScore: Number(row.performanceScore),
          masteryScore: Number(row.masteryScore),
          confidenceScore: Number(row.confidenceScore),
          evidenceCount: row.evidenceCount,
        })),
        feedback,
        policyOutcome: attempt.policyOutcome,
        evaluatedAt: attempt.evaluatedAt.toISOString(),
      },
      nodeProgress: progress.nodeProgress,
      moduleProgress: progress.moduleProgress,
      xpAwarded: attempt.xpAwarded,
      nextAction: this.nextAction(attempt.policyOutcome, progress),
    };
  }

  private async assertOwnedNode(userId: string, moduleId: string, nodeId: string): Promise<void> {
    const [row] = await this.infrastructure.database.db
      .select({ status: modules.status, origin: module_nodes.origin })
      .from(modules)
      .innerJoin(
        module_nodes,
        and(eq(module_nodes.module_id, modules.id), eq(module_nodes.id, nodeId)),
      )
      .where(and(eq(modules.id, moduleId), eq(modules.owner_id, userId)))
      .limit(1);
    if (!row) notFound();
    if (row.status !== "ready") {
      throw new ProductError(
        409,
        "MODULE_NOT_LEARNABLE",
        "Module is not learnable",
        "Only a ready Module accepts assessment submissions.",
      );
    }
    if (row.origin !== "core") responseValidationError("M6 only supports Core Node assessments.");
  }

  private validateSubmission(
    assessmentRows: Array<
      ActivityRow & { type: "multiple_choice" | "true_false" | "short_answer" }
    >,
    responses: SubmitAttemptBody["responses"],
  ): void {
    if (assessmentRows.length === 0) {
      responseValidationError("The node must contain at least one assessment activity.");
    }
    if (responses.length !== assessmentRows.length) {
      responseValidationError("Every assessment activity must be answered exactly once.");
    }
    const byId = new Map(assessmentRows.map((activity) => [activity.id, activity]));
    const seen = new Set<string>();
    for (const response of responses) {
      const activity = byId.get(response.activityId);
      if (!activity || seen.has(response.activityId)) {
        responseValidationError("Responses contain a missing, duplicate, or foreign activity.");
      }
      seen.add(response.activityId);
      if (activity.type === "multiple_choice") {
        if (!("optionIndex" in response.answer)) {
          responseValidationError("A multiple-choice response requires optionIndex.");
        }
        const options = z
          .object({ options: z.array(z.unknown()) })
          .loose()
          .safeParse(activity.content);
        if (!options.success || response.answer.optionIndex >= options.data.options.length) {
          responseValidationError(
            "A multiple-choice optionIndex is outside the available options.",
          );
        }
      } else if (activity.type === "true_false") {
        if (!("value" in response.answer)) {
          responseValidationError("A true/false response requires value.");
        }
      } else if (!("text" in response.answer)) {
        responseValidationError("A short-answer response requires text.");
      }
    }
  }

  private async finalizeDeterministicAttempt(attemptId: string): Promise<void> {
    const [rows, concepts] = await Promise.all([
      this.infrastructure.database.db
        .select({
          activityId: attempt_responses.activity_id,
          answer: attempt_responses.response,
          type: activities.type,
          content: activities.content,
          evaluationConfig: activities.evaluation_config,
        })
        .from(attempt_responses)
        .innerJoin(activities, eq(activities.id, attempt_responses.activity_id))
        .where(eq(attempt_responses.attempt_id, attemptId))
        .orderBy(asc(activities.position)),
      this.infrastructure.database.db
        .select({ key: module_concepts.key })
        .from(module_concepts)
        .innerJoin(attempts, eq(attempts.module_id, module_concepts.module_id))
        .where(eq(attempts.id, attemptId)),
    ]);
    try {
      if (rows.some(({ type }) => type !== "multiple_choice" && type !== "true_false")) {
        throw new InvalidEvaluationConfigurationError();
      }
      const evaluated = evaluateDeterministicActivities({
        activities: rows.map((row) => ({
          id: row.activityId,
          type: row.type as "multiple_choice" | "true_false",
          content: row.content,
          evaluationConfig: row.evaluationConfig,
        })),
        answers: new Map(rows.map((row) => [row.activityId, row.answer as DeterministicAnswer])),
        knownConceptKeys: new Set(concepts.map(({ key }) => key)),
      });
      await finalizeAttemptEvaluation(this.infrastructure.database, {
        attemptId,
        ...evaluated,
        feedback: null,
      });
    } catch (error) {
      if (!(error instanceof InvalidEvaluationConfigurationError)) throw error;
      await failAttemptEvaluation(
        this.infrastructure.database,
        attemptId,
        SAFE_NON_RETRYABLE_EVALUATION_FAILURE,
      );
    }
  }

  private async waitForTerminalStatus(attemptId: string): Promise<void> {
    const deadline = Date.now() + REQUEST_WAIT_MILLISECONDS;
    while (Date.now() < deadline) {
      const [row] = await this.infrastructure.database.db
        .select({ status: attempts.evaluation_status })
        .from(attempts)
        .where(eq(attempts.id, attemptId))
        .limit(1);
      if (row?.status !== "evaluating") return;
      await new Promise((resolve) => setTimeout(resolve, STATUS_POLL_MILLISECONDS));
    }
  }

  private async readProgress(userId: string, moduleId: string, nodeId: string) {
    const [moduleProgress, node, allNodes] = await Promise.all([
      this.infrastructure.database.db
        .select({
          status: user_module_progress.status,
          percentage: user_module_progress.progress_percentage,
          currentNodeId: user_module_progress.current_node_id,
        })
        .from(user_module_progress)
        .where(
          and(
            eq(user_module_progress.user_id, userId),
            eq(user_module_progress.module_id, moduleId),
          ),
        )
        .limit(1),
      this.infrastructure.database.db
        .select({
          status: node_progress.status,
          bestScore: node_progress.best_score,
          attemptCount: node_progress.attempt_count,
        })
        .from(node_progress)
        .where(and(eq(node_progress.user_id, userId), eq(node_progress.node_id, nodeId)))
        .limit(1),
      this.infrastructure.database.db
        .select({ id: module_nodes.id, status: node_progress.status })
        .from(module_nodes)
        .innerJoin(
          node_progress,
          and(eq(node_progress.node_id, module_nodes.id), eq(node_progress.user_id, userId)),
        )
        .where(and(eq(module_nodes.module_id, moduleId), eq(module_nodes.origin, "core")))
        .orderBy(asc(module_nodes.core_position)),
    ]);
    const currentModule = moduleProgress[0];
    const currentNode = node[0];
    if (!currentModule || !currentNode) throw new Error("Attempt progress is missing.");
    const completed = allNodes.filter((candidate) => candidate.status === "completed").length;
    return {
      moduleId,
      currentNodeId: currentModule.currentNodeId,
      nodes: allNodes,
      nodeProgress: {
        status: currentNode.status,
        bestScore: currentNode.bestScore === null ? null : Number(currentNode.bestScore),
        attemptCount: currentNode.attemptCount,
      },
      moduleProgress: {
        status: currentModule.status,
        percentage: Number(currentModule.percentage),
        completedCoreNodes: completed,
        totalCoreNodes: allNodes.length,
      },
    };
  }

  private nextAction(
    policyOutcome: AttemptPolicyOutcome,
    progress: Awaited<ReturnType<AttemptsService["readProgress"]>>,
  ): NextLearningAction {
    if (policyOutcome !== "continue") return { type: "none" };
    if (progress.moduleProgress.status === "completed") {
      return { type: "module_completed", moduleId: progress.moduleId };
    }
    const current = progress.nodes.find((node) => node.id === progress.currentNodeId);
    if (!current) return { type: "none" };
    return {
      type: current.status === "in_progress" ? "resume_core_node" : "start_core_node",
      moduleId: progress.moduleId,
      nodeId: current.id,
    };
  }
}
