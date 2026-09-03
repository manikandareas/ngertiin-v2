import { z } from "zod";

export const stableErrorCodes = [
  "AUTHENTICATION_REQUIRED",
  "AUTHENTICATION_INVALID",
  "AUTHORIZATION_ERROR",
  "NOT_FOUND",
  "VALIDATION_ERROR",
  "IDEMPOTENCY_KEY_REQUIRED",
  "IDEMPOTENCY_CONFLICT",
  "SUBMISSION_CONFLICT",
  "SOURCE_TOO_LARGE",
  "SOURCE_UNSUPPORTED_MEDIA_TYPE",
  "SOURCE_INVALID_PDF",
  "SOURCE_TEXT_NOT_EXTRACTABLE",
  "SOURCE_NOT_READY",
  "SOURCE_PROCESSING_FAILED",
  "SOURCE_RETRY_NOT_ALLOWED",
  "MODULE_NOT_READY",
  "MODULE_NOT_LEARNABLE",
  "MODULE_ARCHIVE_NOT_ALLOWED",
  "GENERATION_NOT_AVAILABLE",
  "GENERATION_RETRY_NOT_ALLOWED",
  "NODE_LOCKED",
  "ATTEMPT_REQUIRED",
  "ACTIVITY_NOT_ASSESSABLE",
  "ATTEMPT_EVALUATION_FAILED",
  "ADAPTIVE_DECISION_ALREADY_MADE",
  "RATE_LIMITED",
  "DEPENDENCY_UNAVAILABLE",
  "INTERNAL_ERROR",
] as const;

export const apiErrorCodeSchema = z.enum(stableErrorCodes);

export const fieldErrorSchema = z.object({
  path: z.string(),
  code: z.string(),
  message: z.string(),
});

export const problemDetailSchema = z.object({
  type: z.string().url(),
  title: z.string(),
  status: z.number().int(),
  code: apiErrorCodeSchema,
  detail: z.string(),
  instance: z.string(),
  requestId: z.string().min(1).max(128),
  errors: z.array(fieldErrorSchema).optional(),
});

export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;
export type FieldError = z.infer<typeof fieldErrorSchema>;
export type ProblemDetail = z.infer<typeof problemDetailSchema>;
