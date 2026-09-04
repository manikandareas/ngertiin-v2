import type { AttemptPolicyOutcome, DeterministicAnswer } from "@ngertiin/contracts/api";
import { z } from "zod";

const conceptWeightSchema = z
  .object({ conceptKey: z.string().min(1), weight: z.number().min(0).max(1) })
  .strict();
const baseEvaluationConfigSchema = z
  .object({ explanation: z.string().min(1), conceptWeights: z.array(conceptWeightSchema).min(1) })
  .strict();
const multipleChoiceConfigSchema = baseEvaluationConfigSchema.extend({
  correctAnswer: z.number().int().nonnegative(),
});
const trueFalseConfigSchema = baseEvaluationConfigSchema.extend({ correctAnswer: z.boolean() });

export type AssessmentActivity = {
  id: string;
  type: "multiple_choice" | "true_false";
  content: unknown;
  evaluationConfig: unknown;
};

export type ActivityEvaluation = {
  activityId: string;
  correct: boolean;
  score: number;
  maxScore: 1;
  explanation: string;
};

export type ConceptPerformance = { conceptKey: string; performanceScore: number };

export class InvalidEvaluationConfigurationError extends Error {
  constructor() {
    super("Assessment evaluation configuration is invalid.");
    this.name = "InvalidEvaluationConfigurationError";
  }
}

export function evaluateDeterministicActivities(input: {
  activities: AssessmentActivity[];
  answers: Map<string, DeterministicAnswer>;
  knownConceptKeys: Set<string>;
}): {
  activityResults: ActivityEvaluation[];
  conceptResults: ConceptPerformance[];
  score: number;
  maxScore: number;
  normalizedScore: number;
} {
  const conceptTotals = new Map<string, { weightedScore: number; totalWeight: number }>();
  const activityResults = input.activities.map((activity) => {
    const answer = input.answers.get(activity.id);
    if (!answer) throw new InvalidEvaluationConfigurationError();
    const parsed =
      activity.type === "multiple_choice"
        ? multipleChoiceConfigSchema.safeParse(activity.evaluationConfig)
        : trueFalseConfigSchema.safeParse(activity.evaluationConfig);
    if (!parsed.success) throw new InvalidEvaluationConfigurationError();

    const config = parsed.data;
    if (
      config.conceptWeights.every(({ weight }) => weight === 0) ||
      new Set(config.conceptWeights.map(({ conceptKey }) => conceptKey).values()).size !==
        config.conceptWeights.length ||
      config.conceptWeights.some(({ conceptKey }) => !input.knownConceptKeys.has(conceptKey))
    ) {
      throw new InvalidEvaluationConfigurationError();
    }

    let correct: boolean;
    if (activity.type === "multiple_choice") {
      const content = z
        .object({ options: z.array(z.string()).min(2) })
        .loose()
        .safeParse(activity.content);
      if (
        !content.success ||
        !("optionIndex" in answer) ||
        typeof config.correctAnswer !== "number" ||
        config.correctAnswer >= content.data.options.length
      ) {
        throw new InvalidEvaluationConfigurationError();
      }
      correct = answer.optionIndex === config.correctAnswer;
    } else {
      if (!("value" in answer) || typeof config.correctAnswer !== "boolean") {
        throw new InvalidEvaluationConfigurationError();
      }
      correct = answer.value === config.correctAnswer;
    }

    const score = correct ? 1 : 0;
    for (const { conceptKey, weight } of config.conceptWeights) {
      const current = conceptTotals.get(conceptKey) ?? { weightedScore: 0, totalWeight: 0 };
      current.weightedScore += score * weight;
      current.totalWeight += weight;
      conceptTotals.set(conceptKey, current);
    }
    return {
      activityId: activity.id,
      correct,
      score,
      maxScore: 1 as const,
      explanation: config.explanation,
    };
  });

  const conceptResults = [...conceptTotals.entries()]
    .map(([conceptKey, value]) => {
      if (value.totalWeight <= 0) throw new InvalidEvaluationConfigurationError();
      return { conceptKey, performanceScore: value.weightedScore / value.totalWeight };
    })
    .sort((left, right) => left.conceptKey.localeCompare(right.conceptKey));
  if (conceptResults.length === 0) throw new InvalidEvaluationConfigurationError();

  const score = activityResults.reduce((total, result) => total + result.score, 0);
  const maxScore = activityResults.length;
  return { activityResults, conceptResults, score, maxScore, normalizedScore: score / maxScore };
}

export function updateMastery(
  oldMastery: number,
  oldEvidenceCount: number,
  performance: number,
): { masteryScore: number; confidenceScore: number; evidenceCount: number } {
  const evidenceCount = oldEvidenceCount + 1;
  const masteryScore = Math.min(
    1,
    Math.max(0, (oldMastery * oldEvidenceCount + performance) / evidenceCount),
  );
  return {
    masteryScore,
    confidenceScore: Math.min(1, evidenceCount / 5),
    evidenceCount,
  };
}

export function selectPolicyOutcome(masteryScores: number[]): AttemptPolicyOutcome {
  if (masteryScores.some((score) => score < 0.5)) return "required_intervention";
  if (masteryScores.some((score) => score < 0.75)) return "optional_review";
  return "continue";
}
