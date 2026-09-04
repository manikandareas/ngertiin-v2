import type { AssessmentFeedback } from "@ngertiin/contracts/api";
import {
  type DatabaseClient,
  activities,
  attempt_concept_results,
  attempt_responses,
  attempts,
  module_concepts,
  modules,
  user_concept_mastery,
} from "@ngertiin/database";
import { and, asc, eq } from "drizzle-orm";
import {
  aggregateConceptContributions,
  type ActivityEvaluation,
  type ConceptContribution,
  InvalidEvaluationConfigurationError,
  selectPolicyOutcome,
  updateMastery,
} from "./assessment.js";
import { finalizeCoreNodeProgress } from "./progression.js";

export type PublicAttemptFailure = {
  code: "ATTEMPT_EVALUATION_FAILED";
  message: string;
  retryable: boolean;
};

export const SAFE_NON_RETRYABLE_EVALUATION_FAILURE: PublicAttemptFailure = {
  code: "ATTEMPT_EVALUATION_FAILED",
  message: "This assessment could not be evaluated. Please review your answers and try again.",
  retryable: false,
};

export const SAFE_RETRYABLE_EVALUATION_FAILURE: PublicAttemptFailure = {
  code: "ATTEMPT_EVALUATION_FAILED",
  message: "This assessment could not be evaluated right now. Please try again later.",
  retryable: true,
};

function validateActivityResults(
  responseIds: string[],
  activityResults: ActivityEvaluation[],
): void {
  const expected = new Set(responseIds);
  const actual = new Set(activityResults.map(({ activityId }) => activityId));
  if (
    expected.size !== responseIds.length ||
    actual.size !== activityResults.length ||
    expected.size !== actual.size ||
    [...expected].some((id) => !actual.has(id)) ||
    activityResults.some(
      (result) =>
        !Number.isFinite(result.score) ||
        result.score < 0 ||
        result.score > 1 ||
        result.maxScore !== 1 ||
        result.explanation.length === 0,
    )
  ) {
    throw new InvalidEvaluationConfigurationError();
  }
}

export async function finalizeAttemptEvaluation(
  database: DatabaseClient,
  input: {
    attemptId: string;
    activityResults: ActivityEvaluation[];
    conceptContributions: ConceptContribution[];
    feedback: AssessmentFeedback | null;
  },
): Promise<boolean> {
  return database.db.transaction(async (transaction) => {
    const [attempt] = await transaction
      .select({
        id: attempts.id,
        userId: attempts.user_id,
        moduleId: attempts.module_id,
        nodeId: attempts.node_id,
        evaluationStatus: attempts.evaluation_status,
      })
      .from(attempts)
      .where(eq(attempts.id, input.attemptId))
      .for("update")
      .limit(1);
    if (attempt?.evaluationStatus !== "evaluating") return false;

    await transaction
      .select({ id: modules.id })
      .from(modules)
      .where(eq(modules.id, attempt.moduleId))
      .for("update")
      .limit(1);

    const [responseRows, concepts] = await Promise.all([
      transaction
        .select({ activityId: attempt_responses.activity_id })
        .from(attempt_responses)
        .innerJoin(activities, eq(activities.id, attempt_responses.activity_id))
        .where(eq(attempt_responses.attempt_id, attempt.id))
        .orderBy(asc(activities.position)),
      transaction
        .select({ id: module_concepts.id, key: module_concepts.key })
        .from(module_concepts)
        .where(eq(module_concepts.module_id, attempt.moduleId)),
    ]);
    validateActivityResults(
      responseRows.map(({ activityId }) => activityId),
      input.activityResults,
    );

    const conceptByKey = new Map(concepts.map((concept) => [concept.key, concept.id]));
    const conceptPerformance = aggregateConceptContributions(input.conceptContributions);
    if (conceptPerformance.some(({ conceptKey }) => !conceptByKey.has(conceptKey))) {
      throw new InvalidEvaluationConfigurationError();
    }

    const masteryResults: Array<{
      conceptId: string;
      conceptKey: string;
      performanceScore: number;
      masteryScore: number;
      confidenceScore: number;
      evidenceCount: number;
    }> = [];
    for (const result of conceptPerformance) {
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

    for (const result of input.activityResults) {
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

    const score = input.activityResults.reduce((total, result) => total + result.score, 0);
    const maxScore = input.activityResults.length;
    if (maxScore === 0) throw new InvalidEvaluationConfigurationError();
    const policyOutcome = selectPolicyOutcome(masteryResults.map((result) => result.masteryScore));
    const progression = await finalizeCoreNodeProgress(transaction, {
      userId: attempt.userId,
      moduleId: attempt.moduleId,
      nodeId: attempt.nodeId,
      normalizedScore: score / maxScore,
      xp: { amount: 20, reason: "quiz_completed" },
    });
    await transaction
      .update(attempts)
      .set({
        evaluation_status: "completed",
        score: String(score),
        max_score: String(maxScore),
        policy_outcome: policyOutcome,
        feedback: input.feedback,
        failure: null,
        xp_awarded: progression.xpAwarded,
        evaluated_at: new Date(),
      })
      .where(eq(attempts.id, attempt.id));
    return true;
  });
}

export async function failAttemptEvaluation(
  database: DatabaseClient,
  attemptId: string,
  failure: PublicAttemptFailure,
): Promise<boolean> {
  return database.db.transaction(async (transaction) => {
    const [attempt] = await transaction
      .select({ id: attempts.id, evaluationStatus: attempts.evaluation_status })
      .from(attempts)
      .where(eq(attempts.id, attemptId))
      .for("update")
      .limit(1);
    if (attempt?.evaluationStatus !== "evaluating") return false;
    await transaction
      .update(attempts)
      .set({ evaluation_status: "failed", failure, evaluated_at: new Date() })
      .where(eq(attempts.id, attempt.id));
    return true;
  });
}
