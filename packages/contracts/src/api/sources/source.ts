import { z } from "zod";
import { successEnvelopeSchema, timestampSchema, uuidSchema } from "../common/identifiers.js";
import { paginatedSuccessEnvelopeSchema } from "../common/pagination.js";

const MAX_TEXT_CODE_POINTS = 100_000;
const MAX_TITLE_CODE_POINTS = 200;
export const MAX_PDF_SIZE_BYTES = 25 * 1024 * 1024;

function codePointLength(value: string): number {
  return Array.from(value).length;
}

export const sourceTypeSchema = z.enum(["pdf", "url", "text"]);
export const sourceStatusSchema = z.enum(["pending", "processing", "ready", "failed"]);
export const sourceFailureCodeSchema = z.enum([
  "SOURCE_TEXT_NOT_EXTRACTABLE",
  "SOURCE_INVALID_PDF",
  "SOURCE_UNSUPPORTED_MEDIA_TYPE",
  "SOURCE_PROCESSING_FAILED",
]);

export const sourceFailureSchema = z.object({
  code: sourceFailureCodeSchema,
  message: z.string(),
  retryable: z.boolean(),
});

export const sourceSchema = z.object({
  retriesRemaining: z.number().int().min(0).max(2).default(0),
  id: uuidSchema,
  type: sourceTypeSchema,
  title: z.string().nullable(),
  status: sourceStatusSchema,
  originalFilename: z.string().optional(),
  originalUrl: z.string().optional(),
  sizeBytes: z.number().int().nonnegative().optional(),
  pageCount: z.number().int().nonnegative().optional(),
  failure: sourceFailureSchema.optional(),
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

const optionalTitleSchema = z
  .string()
  .optional()
  .transform((title) => title?.trim() || null)
  .superRefine((title, context) => {
    if (title !== null && codePointLength(title) > MAX_TITLE_CODE_POINTS) {
      context.addIssue({
        code: "too_big",
        origin: "string",
        maximum: MAX_TITLE_CODE_POINTS,
        inclusive: true,
        message: `Title must contain at most ${MAX_TITLE_CODE_POINTS} Unicode code points.`,
      });
    }
  });

export const createUrlSourceBodySchema = z
  .object({
    title: optionalTitleSchema,
    url: z
      .string()
      .trim()
      .min(1, "URL must not be empty.")
      .superRefine((value, context) => {
        try {
          const url = new URL(value);
          if (url.protocol !== "http:" && url.protocol !== "https:") {
            context.addIssue({ code: "custom", message: "URL must use HTTP or HTTPS." });
          }
        } catch {
          context.addIssue({ code: "custom", message: "URL must be absolute and valid." });
        }
      }),
  })
  .strict();

export const createPdfSourceFieldsSchema = z
  .object({
    title: optionalTitleSchema,
  })
  .strict();

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
export const createUrlSourceResponseSchema = successEnvelopeSchema(sourceSchema);
export const createPdfSourceResponseSchema = successEnvelopeSchema(sourceSchema);
export const listSourcesResponseSchema = paginatedSuccessEnvelopeSchema(sourceSchema);
export const getSourceResponseSchema = successEnvelopeSchema(sourceSchema);
export const retrySourceResponseSchema = successEnvelopeSchema(sourceSchema);

export type SourceType = z.infer<typeof sourceTypeSchema>;
export type SourceStatus = z.infer<typeof sourceStatusSchema>;
export type SourceFailureCode = z.infer<typeof sourceFailureCodeSchema>;
export type SourceFailure = z.infer<typeof sourceFailureSchema>;
export type Source = z.infer<typeof sourceSchema>;
export type CreateTextSourceBodyInput = z.input<typeof createTextSourceBodySchema>;
export type CreateTextSourceBody = z.infer<typeof createTextSourceBodySchema>;
export type CreateUrlSourceBodyInput = z.input<typeof createUrlSourceBodySchema>;
export type CreateUrlSourceBody = z.infer<typeof createUrlSourceBodySchema>;
export type CreatePdfSourceFieldsInput = z.input<typeof createPdfSourceFieldsSchema>;
export type CreatePdfSourceFields = z.infer<typeof createPdfSourceFieldsSchema>;
export type ListSourcesQuery = z.infer<typeof listSourcesQuerySchema>;
export type ListSourcesQueryInput = z.input<typeof listSourcesQuerySchema>;
export type SourceParams = z.infer<typeof sourceParamsSchema>;
export type CreateTextSourceResponse = z.infer<typeof createTextSourceResponseSchema>;
export type CreateUrlSourceResponse = z.infer<typeof createUrlSourceResponseSchema>;
export type CreatePdfSourceResponse = z.infer<typeof createPdfSourceResponseSchema>;
export type ListSourcesResponse = z.infer<typeof listSourcesResponseSchema>;
export type GetSourceResponse = z.infer<typeof getSourceResponseSchema>;
export type RetrySourceResponse = z.infer<typeof retrySourceResponseSchema>;
