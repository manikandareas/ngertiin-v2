import { createHash } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import type {
  AttemptPolicyOutcome,
  AttemptResult,
  DeterministicAnswer,
  NextLearningAction,
  SubmitAttemptBody,
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
  user_concept_mastery,
  user_module_progress,
} from "@ngertiin/database";
import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { ProductError } from "../http/product-error.js";
import { InfrastructureService } from "../infrastructure/infrastructure.service.js";
import { finalizeCoreNodeProgress } from "../progression/finalize-node-progress.js";
import { ASSESSMENT_SUBMISSION_ENABLED } from "./assessment-submission.gate.js";
import {
  evaluateDeterministicActivities,
  InvalidEvaluationConfigurationError,
  selectPolicyOutcome,
  updateMastery,
} from "./attempts.evaluator.js";

const safeEvaluationSchema = z.object({ correct: z.boolean(), explanation: z.string() }).strict();
const safeFailureSchema = z
  .object({
    code: z.literal("ATTEMPT_EVALUATION_FAILED"),
    message: z.string(),
    retryable: z.boolean(),
  })
  .strict();

const SAFE_EVALUATION_FAILURE = {
  code: "ATTEMPT_EVALUATION_FAILED" as const,
  message: "This assessment could not be evaluated. Please try again later.",
  retryable: false,
};

type AssessmentRow = {
  id: string;
  type: "lesson" | "flashcard" | "multiple_choice" | "true_false" | "short_answer";
  content: unknown;
  evaluationConfig: unknown;
};

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

    const attemptId = await this.infrastructure.database.db.transaction(async (transaction) => {
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

      const assessmentRows = await transaction
        .select({
          id: activities.id,
          type: activities.type,
          content: activities.content,
          evaluationConfig: activities.evaluation_config,
        })
        .from(activities)
        .where(eq(activities.node_id, nodeId))
        .orderBy(asc(activities.position));
      this.validateSubmission(assessmentRows, input.responses);
      const submissionHash = normalizedSubmissionHash(input.responses);

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
        return existing.id;
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
      return created.id;
    });

    await this.finalizeAttempt(attemptId);
    return this.getAttempt(userId, attemptId);
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
        xpAwarded: attempts.xp_awarded,
        failure: attempts.failure,
        createdAt: attempts.created_at,
        evaluatedAt: attempts.evaluated_at,
      })
      .from(attempts)
      .where(and(eq(attempts.id, attemptId), eq(attempts.user_id, userId)))
      .limit(1);
    if (!attempt) notFound();

    const [responseRows, conceptRows, progress] = await Promise.all([
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
      this.readProgress(userId, attempt.moduleId, attempt.nodeId),
    ]);

    const activityResults = responseRows.flatMap((row) => {
      const evaluation = safeEvaluationSchema.safeParse(row.evaluation);
      if (!evaluation.success || row.score === null || row.maxScore === null) return [];
      return [
        {
          activityId: row.activityId,
          correct: evaluation.data.correct,
          score: Number(row.score),
          maxScore: Number(row.maxScore),
          explanation: evaluation.data.explanation,
        },
      ];
    });
    const score = attempt.score === null ? null : Number(attempt.score);
    const maxScore = attempt.maxScore === null ? null : Number(attempt.maxScore);
    const failure = safeFailureSchema.safeParse(attempt.failure);

    return {
      attempt: {
        id: attempt.id,
        submissionId: attempt.submissionId,
        attemptNumber: attempt.attemptNumber,
        evaluationStatus: attempt.evaluationStatus,
        score,
        maxScore,
        normalizedScore: score === null || maxScore === null ? null : score / maxScore,
        activityResults,
        conceptResults: conceptRows.map((row) => ({
          conceptKey: row.conceptKey,
          performanceScore: Number(row.performanceScore),
          masteryScore: Number(row.masteryScore),
          confidenceScore: Number(row.confidenceScore),
          evidenceCount: row.evidenceCount,
        })),
        feedback: null,
        policyOutcome: attempt.policyOutcome,
        failure: failure.success ? failure.data : null,
        createdAt: attempt.createdAt.toISOString(),
        evaluatedAt: attempt.evaluatedAt?.toISOString() ?? null,
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
    if (row.origin !== "core") responseValidationError("M5 only supports Core Node assessments.");
  }

  private validateSubmission(
    activityRows: AssessmentRow[],
    responses: SubmitAttemptBody["responses"],
  ): void {
    if (
      activityRows.length === 0 ||
      activityRows.some(({ type }) => type !== "multiple_choice" && type !== "true_false")
    ) {
      responseValidationError(
        "The node must contain only supported multiple-choice or true/false activities.",
      );
    }
    if (responses.length !== activityRows.length) {
      responseValidationError("Every assessment activity must be answered exactly once.");
    }
    const byId = new Map(activityRows.map((activity) => [activity.id, activity]));
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
      } else if (!("value" in response.answer)) {
        responseValidationError("A true/false response requires value.");
      }
    }
  }

  private async finalizeAttempt(attemptId: string): Promise<void> {
    await this.infrastructure.database.db.transaction(async (transaction) => {
      const [attempt] = await transaction
        .select({
          id: attempts.id,
          userId: attempts.user_id,
          moduleId: attempts.module_id,
          nodeId: attempts.node_id,
          evaluationStatus: attempts.evaluation_status,
        })
        .from(attempts)
        .where(eq(attempts.id, attemptId))
        .for("update")
        .limit(1);
      if (attempt?.evaluationStatus !== "evaluating") return;

      await transaction
        .select({ id: modules.id })
        .from(modules)
        .where(eq(modules.id, attempt.moduleId))
        .for("update")
        .limit(1);

      const rows = await transaction
        .select({
          activityId: attempt_responses.activity_id,
          answer: attempt_responses.response,
          type: activities.type,
          content: activities.content,
          evaluationConfig: activities.evaluation_config,
        })
        .from(attempt_responses)
        .innerJoin(activities, eq(activities.id, attempt_responses.activity_id))
        .where(eq(attempt_responses.attempt_id, attempt.id))
        .orderBy(asc(activities.position));
      const concepts = await transaction
        .select({ id: module_concepts.id, key: module_concepts.key })
        .from(module_concepts)
        .where(eq(module_concepts.module_id, attempt.moduleId));
      const conceptByKey = new Map(concepts.map((concept) => [concept.key, concept.id]));

      try {
        const evaluated = evaluateDeterministicActivities({
          activities: rows.map((row) => ({
            id: row.activityId,
            type: row.type as "multiple_choice" | "true_false",
            content: row.content,
            evaluationConfig: row.evaluationConfig,
          })),
          answers: new Map(rows.map((row) => [row.activityId, row.answer as DeterministicAnswer])),
          knownConceptKeys: new Set(conceptByKey.keys()),
        });

        const masteryResults: Array<{
          conceptId: string;
          conceptKey: string;
          performanceScore: number;
          masteryScore: number;
          confidenceScore: number;
          evidenceCount: number;
        }> = [];
        for (const result of evaluated.conceptResults) {
          const conceptId = conceptByKey.get(result.conceptKey);
          if (!conceptId) throw new InvalidEvaluationConfigurationError();
          const [stored] = await transaction
            .select({
              masteryScore: user_concept_mastery.mastery_score,
              evidenceCount: user_concept_mastery.evidence_count,
            })
            .from(user_concept_mastery)
            .where(
              and(
                eq(user_concept_mastery.user_id, attempt.userId),
                eq(user_concept_mastery.module_id, attempt.moduleId),
                eq(user_concept_mastery.concept_id, conceptId),
              ),
            )
            .for("update")
            .limit(1);
          const updated = updateMastery(
            stored ? Number(stored.masteryScore) : 0,
            stored?.evidenceCount ?? 0,
            result.performanceScore,
          );
          await transaction
            .insert(user_concept_mastery)
            .values({
              user_id: attempt.userId,
              module_id: attempt.moduleId,
              concept_id: conceptId,
              mastery_score: String(updated.masteryScore),
              confidence_score: String(updated.confidenceScore),
              evidence_count: updated.evidenceCount,
              updated_at: new Date(),
            })
            .onConflictDoUpdate({
              target: [
                user_concept_mastery.user_id,
                user_concept_mastery.module_id,
                user_concept_mastery.concept_id,
              ],
              set: {
                mastery_score: String(updated.masteryScore),
                confidence_score: String(updated.confidenceScore),
                evidence_count: updated.evidenceCount,
                updated_at: new Date(),
              },
            });
          masteryResults.push({ conceptId, ...result, ...updated });
        }

        for (const result of evaluated.activityResults) {
          await transaction
            .update(attempt_responses)
            .set({
              score: String(result.score),
              max_score: String(result.maxScore),
              evaluation: { correct: result.correct, explanation: result.explanation },
            })
            .where(
              and(
                eq(attempt_responses.attempt_id, attempt.id),
                eq(attempt_responses.activity_id, result.activityId),
              ),
            );
        }
        await transaction.insert(attempt_concept_results).values(
          masteryResults.map((result) => ({
            attempt_id: attempt.id,
            concept_id: result.conceptId,
            performance_score: String(result.performanceScore),
            mastery_score: String(result.masteryScore),
            confidence_score: String(result.confidenceScore),
            evidence_count: result.evidenceCount,
          })),
        );
        const policyOutcome = selectPolicyOutcome(
          masteryResults.map((result) => result.masteryScore),
        );
        const progression = await finalizeCoreNodeProgress(transaction, {
          userId: attempt.userId,
          moduleId: attempt.moduleId,
          nodeId: attempt.nodeId,
          normalizedScore: evaluated.normalizedScore,
          xp: { amount: 20, reason: "quiz_completed" },
        });
        await transaction
          .update(attempts)
          .set({
            evaluation_status: "completed",
            score: String(evaluated.score),
            max_score: String(evaluated.maxScore),
            policy_outcome: policyOutcome,
            xp_awarded: progression.xpAwarded,
            evaluated_at: new Date(),
          })
          .where(eq(attempts.id, attempt.id));
      } catch (error) {
        if (!(error instanceof InvalidEvaluationConfigurationError)) throw error;
        await transaction
          .update(attempts)
          .set({
            evaluation_status: "failed",
            failure: SAFE_EVALUATION_FAILURE,
            evaluated_at: new Date(),
          })
          .where(eq(attempts.id, attempt.id));
      }
    });
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
    policyOutcome: AttemptPolicyOutcome | null,
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
