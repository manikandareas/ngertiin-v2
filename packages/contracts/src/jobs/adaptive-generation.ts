import { z } from "zod";

export const ADAPTIVE_MAX_ATTEMPTS = 3;
export const ADAPTIVE_MAX_RETRIES = 2;
export const ADAPTIVE_RETRY_DELAY_MS = 5_000;

export const adaptiveRunMetadataSchema = z.object({
  attemptNumber: z.number().int().nonnegative().default(0),
  retryCount: z.number().int().min(0).max(ADAPTIVE_MAX_RETRIES).default(0),
  nextRetryAt: z.string().datetime().nullable().default(null),
});

export function readAdaptiveRunMetadata(value: unknown) {
  return adaptiveRunMetadataSchema.parse(value ?? {});
}

export const ADAPTIVE_GENERATION_STEPS = [
  {
    name: "analyze_weak_concepts",
    phase: "understanding_material",
    startProgress: 0,
    completedProgress: 25,
  },
  { name: "plan_remediation", phase: "creating_journey", startProgress: 25, completedProgress: 50 },
  {
    name: "generate_adaptive_activities",
    phase: "generating_activities",
    startProgress: 50,
    completedProgress: 90,
  },
  {
    name: "validate_adaptive_content",
    phase: "validating_content",
    startProgress: 90,
    completedProgress: 100,
  },
] as const;

export type AdaptiveGenerationStep = (typeof ADAPTIVE_GENERATION_STEPS)[number]["name"];

export const adaptiveGenerationJobSchema = z
  .object({
    generationRunId: z.string().uuid(),
    moduleId: z.string().uuid(),
    adaptiveInterventionId: z.string().uuid(),
  })
  .strict();

export type AdaptiveGenerationJob = z.infer<typeof adaptiveGenerationJobSchema>;
