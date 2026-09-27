import { z } from "zod";
import { successEnvelopeSchema, timestampSchema, uuidSchema } from "../common/identifiers.js";
import { languageSchema } from "../common/languages.js";
import { paginatedSuccessEnvelopeSchema } from "../common/pagination.js";

export const practiceKindSchema = z.enum(["flashcard", "quiz", "exam"]);
export const practiceStatusSchema = z.enum(["generating", "ready", "failed"]);
export const practiceDifficultySchema = z.enum(["beginner", "intermediate", "advanced"]);
export const practiceLanguageSchema = languageSchema;
export const practiceQuestionKindSchema = z.enum(["multiple_choice", "true_false", "short_answer"]);

export const practiceSourceSelectionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("module"), moduleId: uuidSchema }).strict(),
  z.object({ kind: z.literal("attachment"), attachmentId: uuidSchema }).strict(),
]);

const compositionSchema = z
  .object({
    multipleChoice: z.number().int().min(0).max(60),
    trueFalse: z.number().int().min(0).max(60),
    shortAnswer: z.number().int().min(0).max(10),
  })
  .strict();

const practiceSettingsFields = z
  .object({
    kind: practiceKindSchema,
    title: z.string().trim().min(1).max(120),
    focus: z.string().trim().min(1).max(2_000),
    language: practiceLanguageSchema,
    difficulty: practiceDifficultySchema,
    itemCount: z.number().int(),
    composition: compositionSchema.nullable(),
    durationMinutes: z.number().int().nullable(),
  })
  .strict();

function validatePracticeSettings(
  value: z.infer<typeof practiceSettingsFields>,
  context: z.RefinementCtx,
) {
  const bounds = value.kind === "flashcard" ? [5, 30] : value.kind === "quiz" ? [5, 20] : [20, 60];
  if (value.itemCount < bounds[0] || value.itemCount > bounds[1])
    context.addIssue({
      code: "custom",
      path: ["itemCount"],
      message: `Jumlah harus ${bounds[0]}–${bounds[1]}.`,
    });
  if (value.kind === "flashcard") {
    if (value.composition !== null)
      context.addIssue({
        code: "custom",
        path: ["composition"],
        message: "Flashcard tidak memiliki komposisi soal.",
      });
    if (value.durationMinutes !== null)
      context.addIssue({
        code: "custom",
        path: ["durationMinutes"],
        message: "Flashcard tidak memiliki timer.",
      });
  } else {
    if (
      !value.composition ||
      Object.values(value.composition).reduce((sum, count) => sum + count, 0) !== value.itemCount
    )
      context.addIssue({
        code: "custom",
        path: ["composition"],
        message: "Komposisi harus sama dengan jumlah soal.",
      });
    if (value.composition && value.composition.shortAnswer > (value.kind === "quiz" ? 5 : 10))
      context.addIssue({
        code: "custom",
        path: ["composition", "shortAnswer"],
        message: "Terlalu banyak esai singkat.",
      });
    if (value.kind === "quiz" && value.durationMinutes !== null)
      context.addIssue({
        code: "custom",
        path: ["durationMinutes"],
        message: "Kuis tidak memiliki timer.",
      });
    if (
      value.kind === "exam" &&
      (value.durationMinutes === null || value.durationMinutes < 20 || value.durationMinutes > 180)
    )
      context.addIssue({
        code: "custom",
        path: ["durationMinutes"],
        message: "Durasi exam harus 20–180 menit.",
      });
  }
}

export const practiceConfigurationSchema = practiceSettingsFields
  .extend({
    destinationModuleId: uuidSchema,
    variationOfId: uuidSchema.optional(),
    sources: z.array(practiceSourceSelectionSchema).min(1).max(10),
  })
  .superRefine((value, context) => {
    validatePracticeSettings(value, context);
    if (
      new Set(
        value.sources.map((source) =>
          source.kind === "module" ? `m:${source.moduleId}` : `a:${source.attachmentId}`,
        ),
      ).size !== value.sources.length
    )
      context.addIssue({
        code: "custom",
        path: ["sources"],
        message: "Sumber tidak boleh berulang.",
      });
  });
export type PracticeConfiguration = z.infer<typeof practiceConfigurationSchema>;

// The route owns the destination and source; form callers cannot supply chat approvals.
export const createPracticeBodySchema = z
  .object({
    requestId: uuidSchema,
    settings: practiceSettingsFields.superRefine(validatePracticeSettings),
  })
  .strict();
export type CreatePracticeBody = z.infer<typeof createPracticeBodySchema>;

export const practiceItemContentSchema = z.discriminatedUnion("type", [
  z
    .object({ type: z.literal("flashcard"), front: z.string().min(1), back: z.string().min(1) })
    .strict(),
  z
    .object({
      type: z.literal("multiple_choice"),
      question: z.string().min(1),
      options: z.array(z.string().min(1)).min(2).max(6),
    })
    .strict(),
  z.object({ type: z.literal("true_false"), question: z.string().min(1) }).strict(),
  z.object({ type: z.literal("short_answer"), question: z.string().min(1) }).strict(),
]);
export const practiceItemKeySchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("flashcard") }).strict(),
  z
    .object({
      type: z.literal("multiple_choice"),
      optionIndex: z.number().int().nonnegative(),
      explanation: z.string().min(1),
    })
    .strict(),
  z
    .object({ type: z.literal("true_false"), value: z.boolean(), explanation: z.string().min(1) })
    .strict(),
  z
    .object({
      type: z.literal("short_answer"),
      rubric: z
        .array(
          z.object({ criterion: z.string().min(1), weight: z.number().positive().max(1) }).strict(),
        )
        .min(1),
      exampleAnswer: z.string().min(1),
      explanation: z.string().min(1),
    })
    .strict(),
]);

export const practiceItemSchema = z
  .object({
    id: uuidSchema,
    position: z.number().int().positive(),
    content: practiceItemContentSchema,
  })
  .strict();
export const practiceSummarySchema = z
  .object({
    id: uuidSchema,
    moduleId: uuidSchema,
    kind: practiceKindSchema,
    title: z.string(),
    status: practiceStatusSchema,
    itemCount: z.number().int().positive(),
    durationMinutes: z.number().int().positive().nullable().optional(),
    preview: z
      .object({ text: z.string(), options: z.array(z.string()) })
      .strict()
      .nullable()
      .optional(),
    archivedAt: timestampSchema.nullable(),
    latestAttempt: z
      .object({
        status: z.enum(["active", "evaluating", "completed", "evaluation_failed"]),
        answeredCount: z.number().int().nonnegative(),
        score: z.number().min(0).max(100).nullable(),
      })
      .nullable(),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .strict();
export const practiceDetailSchema = practiceSummarySchema.extend({
  configuration: practiceConfigurationSchema,
  progress: z.number().int().min(0).max(100),
  failure: z.string().nullable(),
  items: z.array(practiceItemSchema),
});
export const listPracticesQuerySchema = z.object({
  kind: practiceKindSchema.optional(),
  status: practiceStatusSchema.optional(),
  q: z.string().trim().max(500).optional(),
  archived: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export const patchPracticeSchema = z
  .object({ title: z.string().trim().min(1).max(120).optional(), archived: z.boolean().optional() })
  .strict()
  .refine((value) => value.title !== undefined || value.archived !== undefined);
export const practiceAnswerSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("flashcard"), understood: z.boolean() }).strict(),
  z
    .object({ type: z.literal("multiple_choice"), optionIndex: z.number().int().nonnegative() })
    .strict(),
  z.object({ type: z.literal("true_false"), value: z.boolean() }).strict(),
  z
    .object({
      type: z.literal("short_answer"),
      text: z
        .string()
        .refine((text) => Array.from(text).length <= 4_000, "Jawaban maksimal 4.000 karakter."),
    })
    .strict(),
]);
export type PracticeAnswer = z.infer<typeof practiceAnswerSchema>;
export const practiceAttemptSchema = z.object({
  id: uuidSchema,
  practiceId: uuidSchema,
  status: z.enum(["active", "evaluating", "completed", "evaluation_failed"]),
  revision: z.number().int().nonnegative(),
  answers: z.record(uuidSchema, practiceAnswerSchema),
  startedAt: timestampSchema,
  deadlineAt: timestampSchema.nullable(),
  submittedAt: timestampSchema.nullable(),
  score: z.number().min(0).max(100).nullable(),
  xpAwarded: z.number().int().nonnegative(),
  results: z
    .array(
      z
        .object({ itemId: uuidSchema, score: z.number().min(0).max(1), explanation: z.string() })
        .strict(),
    )
    .nullable(),
});
export const patchPracticeAttemptSchema = z
  .object({
    revision: z.number().int().nonnegative(),
    answers: z.record(uuidSchema, practiceAnswerSchema),
  })
  .strict();
export const practiceSummaryResponseSchema = successEnvelopeSchema(practiceSummarySchema);
export const practiceDetailResponseSchema = successEnvelopeSchema(practiceDetailSchema);
export const practiceListResponseSchema = paginatedSuccessEnvelopeSchema(practiceSummarySchema);
export const practiceAttemptResponseSchema = successEnvelopeSchema(practiceAttemptSchema);
export const practiceAttemptsResponseSchema = paginatedSuccessEnvelopeSchema(practiceAttemptSchema);
export type PracticeSummary = z.infer<typeof practiceSummarySchema>;
export type PracticeDetail = z.infer<typeof practiceDetailSchema>;
export type PracticeAttempt = z.infer<typeof practiceAttemptSchema>;
