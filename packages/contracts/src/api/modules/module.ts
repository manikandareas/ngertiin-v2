import { z } from "zod";
import { MODULE_GENERATION_PHASES } from "../../jobs/module-generation.js";
import { successEnvelopeSchema, timestampSchema, uuidSchema } from "../common/identifiers.js";
import { paginatedSuccessEnvelopeSchema } from "../common/pagination.js";

const MAX_INSTRUCTION_CODE_POINTS = 4_000;
const MAX_SOURCES = 10;

function codePointLength(value: string): number {
  return Array.from(value).length;
}

export const moduleStatusSchema = z.enum(["generating", "ready", "failed", "archived"]);
export const moduleProgressStatusSchema = z.enum(["not_started", "in_progress", "completed"]);
export const generationStateSchema = z.enum(["queued", "processing", "completed", "failed"]);
export const generationPhaseSchema = z.enum(MODULE_GENERATION_PHASES);
export const generationPhaseStatusSchema = z.enum(["pending", "processing", "completed", "failed"]);
export const sourceRoleSchema = z.enum(["primary", "reference", "supplementary"]);

export const nextLearningActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("wait_for_module"), moduleId: uuidSchema }),
  z.object({ type: z.literal("retry_module"), moduleId: uuidSchema }),
  z.object({
    type: z.enum(["start_core_node", "resume_core_node"]),
    moduleId: uuidSchema,
    nodeId: uuidSchema,
  }),
  z.object({
    type: z.literal("offer_optional_review"),
    attemptId: uuidSchema,
    interventionId: uuidSchema,
  }),
  z.object({ type: z.literal("wait_for_adaptive"), interventionId: uuidSchema }),
  z.object({
    type: z.enum(["start_adaptive_node", "resume_adaptive_node"]),
    moduleId: uuidSchema,
    nodeId: uuidSchema,
  }),
  z.object({ type: z.literal("module_completed"), moduleId: uuidSchema }),
  z.object({ type: z.literal("none") }),
]);

export const moduleProgressSchema = z.object({
  status: moduleProgressStatusSchema,
  percentage: z.number().min(0).max(100),
  completedCoreNodes: z.number().int().nonnegative(),
  totalCoreNodes: z.number().int().nonnegative(),
});

export const moduleSummarySchema = z.object({
  id: uuidSchema,
  title: z.string().nullable(),
  description: z.string().nullable(),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]).nullable(),
  status: moduleStatusSchema,
  estimatedMinutes: z.number().int().positive().nullable(),
  progress: moduleProgressSchema.nullable(),
  nextAction: nextLearningActionSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

export const generationFailureSchema = z.object({
  code: z.enum([
    "GENERATION_PROVIDER_UNAVAILABLE",
    "GENERATION_INVALID_OUTPUT",
    "GENERATION_CONTEXT_INVALID",
    "GENERATION_FAILED",
  ]),
  message: z.string(),
  retryable: z.boolean(),
});

export const generationStatusSchema = z.object({
  state: generationStateSchema,
  progressPercentage: z.number().int().min(0).max(100),
  currentPhase: generationPhaseSchema.nullable(),
  phases: z.array(
    z.object({
      phase: generationPhaseSchema,
      status: generationPhaseStatusSchema,
    }),
  ),
  failure: generationFailureSchema.nullable(),
  startedAt: timestampSchema.nullable(),
  finishedAt: timestampSchema.nullable(),
});

const sourceSelectorSchema = z
  .object({
    pages: z
      .object({
        from: z.number().int().positive(),
        to: z.number().int().positive(),
      })
      .strict(),
  })
  .strict()
  .superRefine((selector, context) => {
    if (selector.pages.from > selector.pages.to) {
      context.addIssue({
        code: "custom",
        path: ["pages", "to"],
        message: "Page range end must be greater than or equal to its start.",
      });
    }
  });

export const createModuleBodySchema = z
  .object({
    instruction: z.string().optional(),
    sources: z
      .array(
        z
          .object({
            sourceId: uuidSchema,
            role: sourceRoleSchema,
            priority: z.number().int().min(1).max(100),
            selector: sourceSelectorSchema.optional(),
          })
          .strict(),
      )
      .min(1)
      .max(MAX_SOURCES),
  })
  .strict()
  .transform((value) => ({
    instruction: value.instruction?.trim() || null,
    sources: value.sources,
  }))
  .superRefine((value, context) => {
    if (
      value.instruction !== null &&
      codePointLength(value.instruction) > MAX_INSTRUCTION_CODE_POINTS
    ) {
      context.addIssue({
        code: "too_big",
        origin: "string",
        maximum: MAX_INSTRUCTION_CODE_POINTS,
        inclusive: true,
        path: ["instruction"],
        message: `Instruction must contain at most ${MAX_INSTRUCTION_CODE_POINTS} Unicode code points.`,
      });
    }

    const sourceIds = new Set<string>();
    const priorities = new Set<number>();
    let hasPrimary = false;
    value.sources.forEach((source, index) => {
      if (sourceIds.has(source.sourceId)) {
        context.addIssue({
          code: "custom",
          path: ["sources", index, "sourceId"],
          message: "Each Source may only be included once.",
        });
      }
      sourceIds.add(source.sourceId);

      if (priorities.has(source.priority)) {
        context.addIssue({
          code: "custom",
          path: ["sources", index, "priority"],
          message: "Source priorities must be unique.",
        });
      }
      priorities.add(source.priority);
      hasPrimary ||= source.role === "primary";
    });

    if (!hasPrimary) {
      context.addIssue({
        code: "custom",
        path: ["sources"],
        message: "At least one primary Source is required.",
      });
    }
  });

const moduleStatusesQuerySchema = z.string().transform((value, context) => {
  const rawStatuses = value.split(",");
  const statuses = rawStatuses.map((status) => moduleStatusSchema.safeParse(status));
  if (
    rawStatuses.length === 0 ||
    rawStatuses.some((status) => status.length === 0) ||
    statuses.some((status) => !status.success)
  ) {
    context.addIssue({ code: "custom", message: "Module status filter is invalid." });
    return z.NEVER;
  }
  return [...new Set(statuses.map((status) => (status.success ? status.data : "generating")))];
});

export const listModulesQuerySchema = z
  .object({
    status: moduleStatusesQuerySchema.optional(),
    progressStatus: moduleProgressStatusSchema.optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    cursor: z.string().optional(),
  })
  .strict();

export const moduleParamsSchema = z.object({ moduleId: uuidSchema }).strict();
export const moduleNodeParamsSchema = z
  .object({ moduleId: uuidSchema, nodeId: uuidSchema })
  .strict();

export const nodeProgressStatusSchema = z.enum(["locked", "available", "in_progress", "completed"]);

export const nodeProgressSchema = z.object({
  status: nodeProgressStatusSchema,
  bestScore: z.number().min(0).max(100).nullable(),
  attemptCount: z.number().int().nonnegative(),
});

export const journeyNodeSchema = z.object({
  id: uuidSchema,
  origin: z.enum(["core", "adaptive"]),
  type: z.enum([
    "lesson",
    "flashcard",
    "quiz",
    "checkpoint",
    "review",
    "practice",
    "remedial_quiz",
  ]),
  title: z.string(),
  description: z.string().nullable(),
  position: z.number().int().positive(),
  progress: nodeProgressSchema,
  interventionId: uuidSchema.optional(),
});

const lessonActivitySchema = z.object({
  id: uuidSchema,
  type: z.literal("lesson"),
  position: z.number().int().positive(),
  content: z.object({
    introduction: z.string().optional(),
    explanation: z.string(),
    keyPoints: z.array(z.string()),
    examples: z.array(z.string()).optional(),
    summary: z.string().optional(),
  }),
});

const flashcardActivitySchema = z.object({
  id: uuidSchema,
  type: z.literal("flashcard"),
  position: z.number().int().positive(),
  content: z.object({
    cards: z.array(z.object({ front: z.string(), back: z.string(), conceptKey: z.string() })),
  }),
});

export const publicActivitySchema = z.discriminatedUnion("type", [
  lessonActivitySchema,
  flashcardActivitySchema,
  z.object({
    id: uuidSchema,
    type: z.literal("multiple_choice"),
    position: z.number().int().positive(),
    content: z.object({ question: z.string(), options: z.array(z.string()) }),
  }),
  z.object({
    id: uuidSchema,
    type: z.literal("true_false"),
    position: z.number().int().positive(),
    content: z.object({ statement: z.string() }),
  }),
  z.object({
    id: uuidSchema,
    type: z.literal("short_answer"),
    position: z.number().int().positive(),
    content: z.object({ prompt: z.string() }),
  }),
]);

export const journeySummarySchema = z.object({
  module: z.object({
    id: uuidSchema,
    title: z.string(),
    description: z.string().nullable(),
    difficulty: z.enum(["beginner", "intermediate", "advanced"]),
    estimatedMinutes: z.number().int().positive().nullable(),
  }),
  progress: moduleProgressSchema,
  nodes: z.array(journeyNodeSchema),
  nextAction: nextLearningActionSchema,
});

export const nodeDetailSchema = z.object({
  node: journeyNodeSchema,
  activities: z.array(publicActivitySchema),
  moduleProgress: moduleProgressSchema,
  nextAction: nextLearningActionSchema,
});

export const nodeActionResultSchema = z.object({
  nodeProgress: nodeProgressSchema,
  moduleProgress: moduleProgressSchema,
  nextAction: nextLearningActionSchema,
});

export const completeNodeResultSchema = nodeActionResultSchema.extend({
  xpAwarded: z.number().int().nonnegative(),
});

export const createModuleResponseSchema = successEnvelopeSchema(
  z.object({ module: moduleSummarySchema, generation: generationStatusSchema }),
);
export const listModulesResponseSchema = paginatedSuccessEnvelopeSchema(moduleSummarySchema);
export const getModuleResponseSchema = successEnvelopeSchema(moduleSummarySchema);
export const getGenerationResponseSchema = successEnvelopeSchema(generationStatusSchema);
export const retryGenerationResponseSchema = createModuleResponseSchema;
export const getJourneyResponseSchema = successEnvelopeSchema(journeySummarySchema);
export const getNodeResponseSchema = successEnvelopeSchema(nodeDetailSchema);
export const startNodeResponseSchema = successEnvelopeSchema(nodeActionResultSchema);
export const completeNodeResponseSchema = successEnvelopeSchema(completeNodeResultSchema);

export const generationEventSchema = z.discriminatedUnion("event", [
  z.object({ event: z.literal("generation.snapshot"), data: generationStatusSchema }),
  z.object({ event: z.literal("generation.progress"), data: generationStatusSchema }),
  z.object({ event: z.literal("generation.completed"), data: generationStatusSchema }),
  z.object({ event: z.literal("generation.failed"), data: generationStatusSchema }),
]);

export type ModuleStatus = z.infer<typeof moduleStatusSchema>;
export type ModuleProgressStatus = z.infer<typeof moduleProgressStatusSchema>;
export type NextLearningAction = z.infer<typeof nextLearningActionSchema>;
export type ModuleSummary = z.infer<typeof moduleSummarySchema>;
export type GenerationState = z.infer<typeof generationStateSchema>;
export type GenerationPhase = z.infer<typeof generationPhaseSchema>;
export type GenerationStatus = z.infer<typeof generationStatusSchema>;
export type GenerationFailure = z.infer<typeof generationFailureSchema>;
export type GenerationEvent = z.infer<typeof generationEventSchema>;
export type SourceRole = z.infer<typeof sourceRoleSchema>;
export type CreateModuleBodyInput = z.input<typeof createModuleBodySchema>;
export type CreateModuleBody = z.infer<typeof createModuleBodySchema>;
export type ListModulesQueryInput = z.input<typeof listModulesQuerySchema>;
export type ListModulesQuery = z.infer<typeof listModulesQuerySchema>;
export type ModuleParams = z.infer<typeof moduleParamsSchema>;
export type ModuleNodeParams = z.infer<typeof moduleNodeParamsSchema>;
export type NodeProgressStatus = z.infer<typeof nodeProgressStatusSchema>;
export type NodeProgress = z.infer<typeof nodeProgressSchema>;
export type JourneyNode = z.infer<typeof journeyNodeSchema>;
export type PublicActivity = z.infer<typeof publicActivitySchema>;
export type JourneySummary = z.infer<typeof journeySummarySchema>;
export type NodeDetail = z.infer<typeof nodeDetailSchema>;
export type NodeActionResult = z.infer<typeof nodeActionResultSchema>;
export type CompleteNodeResult = z.infer<typeof completeNodeResultSchema>;
export type GetJourneyResponse = z.infer<typeof getJourneyResponseSchema>;
export type GetNodeResponse = z.infer<typeof getNodeResponseSchema>;
export type StartNodeResponse = z.infer<typeof startNodeResponseSchema>;
export type CompleteNodeResponse = z.infer<typeof completeNodeResponseSchema>;
export type CreateModuleResponse = z.infer<typeof createModuleResponseSchema>;
export type ListModulesResponse = z.infer<typeof listModulesResponseSchema>;
export type GetModuleResponse = z.infer<typeof getModuleResponseSchema>;
export type GetGenerationResponse = z.infer<typeof getGenerationResponseSchema>;
export type RetryGenerationResponse = z.infer<typeof retryGenerationResponseSchema>;
