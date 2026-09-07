import { z } from "zod";
import { successEnvelopeSchema, timestampSchema, uuidSchema } from "../common/identifiers.js";
import {
  moduleProgressSchema,
  nextLearningActionSchema,
  nodeProgressSchema,
} from "../modules/module.js";

export const attemptParamsSchema = z.object({ attemptId: uuidSchema }).strict();

export const multipleChoiceAnswerSchema = z
  .object({ optionIndex: z.number().int().nonnegative() })
  .strict();
export const trueFalseAnswerSchema = z.object({ value: z.boolean() }).strict();
export const shortAnswerSchema = z
  .object({
    text: z
      .string()
      .transform((value) => value.trim())
      .refine((value) => value.length > 0, "Short answer must not be empty.")
      .refine((value) => Array.from(value).length <= 4_000, {
        message: "Short answer must contain at most 4,000 Unicode code points.",
      }),
  })
  .strict();
export const deterministicAnswerSchema = z.union([
  multipleChoiceAnswerSchema,
  trueFalseAnswerSchema,
]);
export const assessmentAnswerSchema = z.union([
  multipleChoiceAnswerSchema,
  trueFalseAnswerSchema,
  shortAnswerSchema,
]);

export const submitAttemptBodySchema = z
  .object({
    submissionId: uuidSchema,
    responses: z
      .array(
        z
          .object({
            activityId: uuidSchema,
            answer: assessmentAnswerSchema,
          })
          .strict(),
      )
      .min(1),
  })
  .strict();

export const attemptEvaluationStatusSchema = z.enum(["evaluating", "completed", "failed"]);
export const attemptPolicyOutcomeSchema = z.enum([
  "continue",
  "optional_review",
  "required_intervention",
]);

export const attemptFailureSchema = z.object({
  code: z.literal("ATTEMPT_EVALUATION_FAILED"),
  message: z.string(),
  retryable: z.boolean(),
});

export const attemptActivityResultSchema = z.object({
  activityId: uuidSchema,
  answer: assessmentAnswerSchema,
  correct: z.boolean(),
  score: z.number().min(0),
  maxScore: z.number().positive(),
  explanation: z.string(),
});

export const attemptConceptResultSchema = z.object({
  conceptKey: z.string(),
  performanceScore: z.number().min(0).max(1),
  masteryScore: z.number().min(0).max(1),
  confidenceScore: z.number().min(0).max(1),
  evidenceCount: z.number().int().positive(),
});

export const assessmentFeedbackSchema = z
  .object({
    summary: z.string(),
    strengths: z.array(z.string()),
    areasToImprove: z.array(z.string()),
  })
  .strict();

const attemptIdentitySchema = z.object({
  id: uuidSchema,
  submissionId: uuidSchema,
  attemptNumber: z.number().int().positive(),
  createdAt: timestampSchema,
});

export const evaluatingAttemptSchema = attemptIdentitySchema.extend({
  evaluationStatus: z.literal("evaluating"),
});

export const completedAttemptSchema = attemptIdentitySchema.extend({
  evaluationStatus: z.literal("completed"),
  score: z.number().min(0),
  maxScore: z.number().positive(),
  normalizedScore: z.number().min(0).max(1),
  activityResults: z.array(attemptActivityResultSchema),
  conceptResults: z.array(attemptConceptResultSchema),
  feedback: assessmentFeedbackSchema.nullable(),
  policyOutcome: attemptPolicyOutcomeSchema,
  evaluatedAt: timestampSchema,
});

export const failedAttemptSchema = attemptIdentitySchema.extend({
  evaluationStatus: z.literal("failed"),
  failure: attemptFailureSchema,
  evaluatedAt: timestampSchema,
});

export const attemptSchema = z.discriminatedUnion("evaluationStatus", [
  evaluatingAttemptSchema,
  completedAttemptSchema,
  failedAttemptSchema,
]);

export const attemptResultSchema = z.object({
  attempt: attemptSchema,
  nodeProgress: nodeProgressSchema,
  moduleProgress: moduleProgressSchema,
  xpAwarded: z.number().int().nonnegative(),
  nextAction: nextLearningActionSchema,
});

export const submitAttemptResponseSchema = successEnvelopeSchema(attemptResultSchema);
export const getAttemptResponseSchema = successEnvelopeSchema(attemptResultSchema);

export type AttemptParams = z.infer<typeof attemptParamsSchema>;
export type DeterministicAnswer = z.infer<typeof deterministicAnswerSchema>;
export type AssessmentAnswer = z.infer<typeof assessmentAnswerSchema>;
export type AssessmentFeedback = z.infer<typeof assessmentFeedbackSchema>;
export type SubmitAttemptBody = z.infer<typeof submitAttemptBodySchema>;
export type AttemptEvaluationStatus = z.infer<typeof attemptEvaluationStatusSchema>;
export type AttemptPolicyOutcome = z.infer<typeof attemptPolicyOutcomeSchema>;
export type Attempt = z.infer<typeof attemptSchema>;
export type AttemptResult = z.infer<typeof attemptResultSchema>;
export type SubmitAttemptResponse = z.infer<typeof submitAttemptResponseSchema>;
export type GetAttemptResponse = z.infer<typeof getAttemptResponseSchema>;
