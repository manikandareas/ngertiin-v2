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
export const deterministicAnswerSchema = z.union([
  multipleChoiceAnswerSchema,
  trueFalseAnswerSchema,
]);

export const submitAttemptBodySchema = z
  .object({
    submissionId: uuidSchema,
    responses: z
      .array(
        z
          .object({
            activityId: uuidSchema,
            answer: deterministicAnswerSchema,
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

export const attemptSchema = z.object({
  id: uuidSchema,
  submissionId: uuidSchema,
  attemptNumber: z.number().int().positive(),
  evaluationStatus: attemptEvaluationStatusSchema,
  score: z.number().min(0).nullable(),
  maxScore: z.number().positive().nullable(),
  normalizedScore: z.number().min(0).max(1).nullable(),
  activityResults: z.array(attemptActivityResultSchema),
  conceptResults: z.array(attemptConceptResultSchema),
  feedback: z.null(),
  policyOutcome: attemptPolicyOutcomeSchema.nullable(),
  failure: attemptFailureSchema.nullable(),
  createdAt: timestampSchema,
  evaluatedAt: timestampSchema.nullable(),
});

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
export type SubmitAttemptBody = z.infer<typeof submitAttemptBodySchema>;
export type AttemptEvaluationStatus = z.infer<typeof attemptEvaluationStatusSchema>;
export type AttemptPolicyOutcome = z.infer<typeof attemptPolicyOutcomeSchema>;
export type Attempt = z.infer<typeof attemptSchema>;
export type AttemptResult = z.infer<typeof attemptResultSchema>;
export type SubmitAttemptResponse = z.infer<typeof submitAttemptResponseSchema>;
export type GetAttemptResponse = z.infer<typeof getAttemptResponseSchema>;
