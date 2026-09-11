import { z } from "zod";
import { successEnvelopeSchema, timestampSchema, uuidSchema } from "../common/identifiers.js";
import { paginatedSuccessEnvelopeSchema } from "../common/pagination.js";

export const chatRunStatusSchema = z.enum([
  "queued",
  "running",
  "cancelling",
  "completed",
  "failed",
  "cancelled",
  "timed_out",
  "interrupted",
]);
export const chatRunErrorSchema = z.enum([
  "PROVIDER_ERROR",
  "STEP_LIMIT",
  "OUTPUT_LIMIT",
  "RUN_TIMEOUT",
  "USER_CANCELLED",
  "PROCESS_INTERRUPTED",
]);
export const activeChatStatuses = ["queued", "running", "cancelling"] as const;
export const isChatRunActive = (status: string) =>
  (activeChatStatuses as readonly string[]).includes(status);
export const chatPageContextSchema = z.discriminatedUnion("surface", [
  z.object({ surface: z.literal("journey") }).strict(),
  z.object({ surface: z.literal("node"), nodeId: uuidSchema }).strict(),
]);
const range = {
  contentRevision: z.string().regex(/^[a-f0-9]{64}$/),
  startCodePoint: z.number().int().nonnegative(),
  endCodePoint: z.number().int().positive(),
};
export const chatContextReferenceSchema = z
  .discriminatedUnion("kind", [
    z
      .object({ kind: z.literal("activity"), nodeId: uuidSchema, activityId: uuidSchema, ...range })
      .strict(),
    z
      .object({
        kind: z.literal("source"),
        sourceId: uuidSchema,
        sourceContentId: uuidSchema,
        ...range,
      })
      .strict(),
  ])
  .refine((value) => value.endCodePoint > value.startCodePoint, "Invalid reference range");
export const chatTitleSchema = z
  .string()
  .trim()
  .refine(
    (value) => [...value].length >= 1 && [...value].length <= 120,
    "Judul harus berisi 1–120 karakter.",
  );
export const createChatThreadSchema = z.object({ title: chatTitleSchema.optional() }).strict();
export const patchChatThreadSchema = z.object({ title: chatTitleSchema }).strict();
export const chatThreadParamsSchema = z.object({ moduleId: uuidSchema, threadId: uuidSchema });
export const chatRunParamsSchema = chatThreadParamsSchema.extend({ runId: uuidSchema });
export const chatPaginationSchema = z.object({
  cursor: z.string().max(2048).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export const sendChatMessageSchema = z
  .object({
    text: z.string().trim().min(1),
    pageContext: chatPageContextSchema.optional(),
    references: z.array(chatContextReferenceSchema).default([]),
    retryOfRunId: uuidSchema.optional(),
  })
  .strict();
export const chatUsageSchema = z.object({
  inputTokens: z.number().int().nonnegative().nullable(),
  outputTokens: z.number().int().nonnegative().nullable(),
  totalTokens: z.number().int().nonnegative().nullable(),
  coverage: z.enum(["complete", "partial", "unavailable"]),
});
export const chatRunDataSchema = z.object({
  status: chatRunStatusSchema,
  errorCode: chatRunErrorSchema.nullable(),
});
// M1 exposes text and terminal status only. Material/tool parts are added with M3.
export const chatPartSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), text: z.string() }),
  z.object({ type: z.literal("data-run-status"), data: chatRunDataSchema }),
]);
export const chatThreadSchema = z.object({
  id: uuidSchema,
  moduleId: uuidSchema,
  title: chatTitleSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
  activeRunId: uuidSchema.nullable(),
});
export const chatMessageSchema = z.object({
  id: uuidSchema,
  threadId: uuidSchema,
  runId: uuidSchema,
  sequence: z.number().int().positive(),
  role: z.enum(["user", "assistant"]),
  parts: z.array(chatPartSchema),
  contexts: z.array(chatPageContextSchema),
  createdAt: timestampSchema,
  availability: z.enum(["available", "unavailable"]),
});
export const chatRunSchema = z.object({
  id: uuidSchema,
  threadId: uuidSchema,
  messageId: uuidSchema,
  assistantMessageId: uuidSchema.nullable(),
  status: chatRunStatusSchema,
  createdAt: timestampSchema,
  startedAt: timestampSchema.nullable(),
  finishedAt: timestampSchema.nullable(),
  errorCode: chatRunErrorSchema.nullable(),
  usage: chatUsageSchema,
});
export const chatAcknowledgmentSchema = z.object({
  messageId: uuidSchema,
  runId: uuidSchema,
  status: z.literal("queued"),
  eventsUrl: z.string().startsWith("/api/v1/modules/"),
});
export const chatThreadResponseSchema = successEnvelopeSchema(chatThreadSchema);
export const chatThreadsResponseSchema = paginatedSuccessEnvelopeSchema(chatThreadSchema);
export const chatMessagesResponseSchema = paginatedSuccessEnvelopeSchema(chatMessageSchema);
export const chatRunResponseSchema = successEnvelopeSchema(chatRunSchema);
export const chatSendResponseSchema = successEnvelopeSchema(chatAcknowledgmentSchema);
export type ChatThread = z.infer<typeof chatThreadSchema>;
export type ChatMessage = z.infer<typeof chatMessageSchema>;
export type ChatPart = z.infer<typeof chatPartSchema>;
export type ChatRun = z.infer<typeof chatRunSchema>;
export type ChatPageContext = z.infer<typeof chatPageContextSchema>;
export type ChatPagination = z.infer<typeof chatPaginationSchema>;
export type SendChatMessage = z.infer<typeof sendChatMessageSchema>;
export type ChatAcknowledgment = z.infer<typeof chatAcknowledgmentSchema>;
export type ChatRunStatus = z.infer<typeof chatRunStatusSchema>;
export type ChatRunError = z.infer<typeof chatRunErrorSchema>;
export type ChatUsage = z.infer<typeof chatUsageSchema>;
