import { z } from "zod";
import { successEnvelopeSchema, timestampSchema, uuidSchema } from "../common/identifiers.js";
import { paginatedSuccessEnvelopeSchema } from "../common/pagination.js";

const MAX_TEXT_CODE_POINTS = 100_000;
const MAX_TITLE_CODE_POINTS = 200;

function codePointLength(value: string): number {
  return Array.from(value).length;
}

export const sourceTypeSchema = z.enum(["pdf", "url", "text"]);
export const sourceStatusSchema = z.enum(["pending", "processing", "ready", "failed"]);

export const sourceSchema = z.object({
  id: uuidSchema,
  type: sourceTypeSchema,
  title: z.string().nullable(),
  status: sourceStatusSchema,
  originalFilename: z.string().optional(),
  originalUrl: z.string().optional(),
  sizeBytes: z.number().int().nonnegative().optional(),
  pageCount: z.number().int().nonnegative().optional(),
  failure: z
    .object({
      code: z.string(),
      message: z.string(),
      retryable: z.boolean(),
    })
    .optional(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

export const createTextSourceBodySchema = z
  .object({
    title: z.string().optional(),
    text: z.string(),
  })
  .strict()
  .transform((value) => ({
    title: value.title?.trim() || null,
    text: value.text.trim(),
  }))
  .superRefine((value, context) => {
    if (value.text.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["text"],
        message: "Text must not be empty.",
      });
    } else if (codePointLength(value.text) > MAX_TEXT_CODE_POINTS) {
      context.addIssue({
        code: "too_big",
        origin: "string",
        maximum: MAX_TEXT_CODE_POINTS,
        inclusive: true,
        path: ["text"],
        message: `Text must contain at most ${MAX_TEXT_CODE_POINTS} Unicode code points.`,
      });
    }

    if (value.title !== null && codePointLength(value.title) > MAX_TITLE_CODE_POINTS) {
      context.addIssue({
        code: "too_big",
        origin: "string",
        maximum: MAX_TITLE_CODE_POINTS,
        inclusive: true,
        path: ["title"],
        message: `Title must contain at most ${MAX_TITLE_CODE_POINTS} Unicode code points.`,
      });
    }
  });

export const listSourcesQuerySchema = z
  .object({
    type: sourceTypeSchema.optional(),
    status: sourceStatusSchema.optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    cursor: z.string().optional(),
  })
  .strict();

export const sourceParamsSchema = z.object({ sourceId: uuidSchema }).strict();
export const idempotencyKeySchema = z
  .string()
  .max(255)
  .refine((value) => value.trim().length > 0, "Idempotency key must not be empty.");

export const createTextSourceResponseSchema = successEnvelopeSchema(sourceSchema);
export const listSourcesResponseSchema = paginatedSuccessEnvelopeSchema(sourceSchema);
export const getSourceResponseSchema = successEnvelopeSchema(sourceSchema);

export type SourceType = z.infer<typeof sourceTypeSchema>;
export type SourceStatus = z.infer<typeof sourceStatusSchema>;
export type Source = z.infer<typeof sourceSchema>;
export type CreateTextSourceBodyInput = z.input<typeof createTextSourceBodySchema>;
export type CreateTextSourceBody = z.infer<typeof createTextSourceBodySchema>;
export type ListSourcesQuery = z.infer<typeof listSourcesQuerySchema>;
export type ListSourcesQueryInput = z.input<typeof listSourcesQuerySchema>;
export type SourceParams = z.infer<typeof sourceParamsSchema>;
export type CreateTextSourceResponse = z.infer<typeof createTextSourceResponseSchema>;
export type ListSourcesResponse = z.infer<typeof listSourcesResponseSchema>;
export type GetSourceResponse = z.infer<typeof getSourceResponseSchema>;
