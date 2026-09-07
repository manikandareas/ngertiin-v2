import { z } from "zod";
import { successEnvelopeSchema, timestampSchema, uuidSchema } from "../common/identifiers.js";
import {
  generationStatusSchema,
  journeyNodeSchema,
  nextLearningActionSchema,
} from "../modules/module.js";

export const adaptiveInterventionStatusSchema = z.enum([
  "offered",
  "generating",
  "available",
  "in_progress",
  "completed",
  "failed",
  "skipped",
]);

export const adaptiveDecisionSchema = z.enum(["accept", "decline"]);
export const adaptiveDecisionBodySchema = z.object({ decision: adaptiveDecisionSchema }).strict();
export const adaptiveInterventionParamsSchema = z.object({ interventionId: uuidSchema }).strict();

export const adaptiveInterventionSchema = z.object({
  id: uuidSchema,
  moduleId: uuidSchema,
  status: adaptiveInterventionStatusSchema,
  required: z.boolean(),
  reasonSummary: z.string().nullable(),
  triggerNodeId: uuidSchema,
  resumeNodeId: uuidSchema.nullable(),
  targetConcepts: z.array(
    z.object({
      key: z.string(),
      name: z.string(),
      masteryScore: z.number().min(0).max(1),
    }),
  ),
  nodes: z.array(journeyNodeSchema),
  generation: generationStatusSchema.nullable(),
  nextAction: nextLearningActionSchema,
  coreNextAction: nextLearningActionSchema,
  createdAt: timestampSchema,
  completedAt: timestampSchema.nullable(),
});

export const getAdaptiveInterventionResponseSchema = successEnvelopeSchema(
  adaptiveInterventionSchema,
);
export const decideAdaptiveInterventionResponseSchema = getAdaptiveInterventionResponseSchema;

const adaptiveGenerationEventDataSchema = z.object({
  generation: generationStatusSchema,
  nextAction: nextLearningActionSchema,
});

export const adaptiveGenerationEventSchema = z.discriminatedUnion("event", [
  z.object({ event: z.literal("generation.snapshot"), data: adaptiveGenerationEventDataSchema }),
  z.object({ event: z.literal("generation.progress"), data: adaptiveGenerationEventDataSchema }),
  z.object({ event: z.literal("generation.completed"), data: adaptiveGenerationEventDataSchema }),
  z.object({ event: z.literal("generation.failed"), data: adaptiveGenerationEventDataSchema }),
]);

export type AdaptiveInterventionStatus = z.infer<typeof adaptiveInterventionStatusSchema>;
export type AdaptiveDecision = z.infer<typeof adaptiveDecisionSchema>;
export type AdaptiveDecisionBody = z.infer<typeof adaptiveDecisionBodySchema>;
export type AdaptiveInterventionParams = z.infer<typeof adaptiveInterventionParamsSchema>;
export type AdaptiveIntervention = z.infer<typeof adaptiveInterventionSchema>;
export type GetAdaptiveInterventionResponse = z.infer<typeof getAdaptiveInterventionResponseSchema>;
export type DecideAdaptiveInterventionResponse = z.infer<
  typeof decideAdaptiveInterventionResponseSchema
>;
export type AdaptiveGenerationEvent = z.infer<typeof adaptiveGenerationEventSchema>;
