import type {
  AssessmentFeedback,
  AttemptPolicyOutcome,
  DeterministicAnswer,
} from "@ngertiin/contracts/api";
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

export const shortAnswerEvaluationConfigSchema = z
  .object({
    expectedConcepts: z.array(z.string().min(1)).min(1).max(20),
    rubric: z
      .array(z.object({ criterion: z.string().min(1), weight: z.number().min(0).max(1) }).strict())
      .min(1)
      .max(12),
  })
  .strict();

export type DeterministicActivity = {
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

export type ConceptContribution = { conceptKey: string; score: number; weight: number };

export type AttemptEvaluation = {
  activityResults: ActivityEvaluation[];
  conceptContributions: ConceptContribution[];
  feedback: AssessmentFeedback | null;
};

export class InvalidEvaluationConfigurationError extends Error {
  constructor() {
    super("Assessment evaluation configuration is invalid.");
    this.name = "InvalidEvaluationConfigurationError";
  }
}

export function evaluateDeterministicActivities(input: {
  activities: DeterministicActivity[];
  answers: Map<string, DeterministicAnswer>;
  knownConceptKeys: Set<string>;
}): Pick<AttemptEvaluation, "activityResults" | "conceptContributions"> {
  const conceptContributions: ConceptContribution[] = [];
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
      new Set(config.conceptWeights.map(({ conceptKey }) => conceptKey)).size !==
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
    conceptContributions.push(
      ...config.conceptWeights.map(({ conceptKey, weight }) => ({ conceptKey, score, weight })),
    );
    return {
      activityId: activity.id,
      correct,
      score,
      maxScore: 1 as const,
      explanation: config.explanation,
    };
  });

  return { activityResults, conceptContributions };
}

export function aggregateConceptContributions(
  contributions: ConceptContribution[],
): Array<{ conceptKey: string; performanceScore: number }> {
  const totals = new Map<string, { weightedScore: number; totalWeight: number }>();
  for (const contribution of contributions) {
    if (
      !Number.isFinite(contribution.score) ||
      contribution.score < 0 ||
      contribution.score > 1 ||
      !Number.isFinite(contribution.weight) ||
      contribution.weight < 0
    ) {
      throw new InvalidEvaluationConfigurationError();
    }
    const current = totals.get(contribution.conceptKey) ?? {
      weightedScore: 0,
      totalWeight: 0,
    };
    current.weightedScore += contribution.score * contribution.weight;
    current.totalWeight += contribution.weight;
    totals.set(contribution.conceptKey, current);
  }
  const results = [...totals.entries()]
    .map(([conceptKey, total]) => {
      if (total.totalWeight <= 0) throw new InvalidEvaluationConfigurationError();
      return { conceptKey, performanceScore: total.weightedScore / total.totalWeight };
    })
    .sort((left, right) => left.conceptKey.localeCompare(right.conceptKey));
  if (results.length === 0) throw new InvalidEvaluationConfigurationError();
  return results;
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
