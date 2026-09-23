import { z } from "zod";
import { successEnvelopeSchema, timestampSchema, uuidSchema } from "../common/identifiers.js";
import { paginatedSuccessEnvelopeSchema } from "../common/pagination.js";
import { lessonImageSchema } from "../modules/module.js";

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
  "ATTACHMENT_UNREADABLE",
  "CONTEXT_LIMIT",
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
export type ChatContextReference = z.infer<typeof chatContextReferenceSchema>;
export const chatMaterialTargetSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("activity"), nodeId: uuidSchema, activityId: uuidSchema }).strict(),
  z
    .object({ kind: z.literal("source"), sourceId: uuidSchema, sourceContentId: uuidSchema })
    .strict(),
]);
export type ChatMaterialTarget = z.infer<typeof chatMaterialTargetSchema>;
export const chatMaterialCitationSchema = z.object({
  id: uuidSchema,
  origin: z.enum(["generated_material", "original_source"]),
  title: z.string(),
  reference: chatContextReferenceSchema,
  excerpt: z.string(),
  pageNumber: z.number().int().positive().nullable(),
  sectionTitle: z.string().nullable(),
});
export const chatWebCitationSchema = z.object({
  id: uuidSchema,
  origin: z.literal("web"),
  title: z.string(),
  url: z.url({ protocol: /^https?$/ }),
  // UTF-16 offsets into the persisted answer, independent of presentation markers.
  occurrences: z.array(
    z
      .object({
        start: z.number().int().nonnegative(),
        end: z.number().int().nonnegative(),
      })
      .refine((range) => range.end >= range.start),
  ),
});
export type ChatWebCitation = z.infer<typeof chatWebCitationSchema>;
export const chatCitationSchema = z.union([chatMaterialCitationSchema, chatWebCitationSchema]);
export type ChatCitation = z.infer<typeof chatCitationSchema>;
export const chatCitationSnapshotSchema = z.object({
  citation: chatMaterialCitationSchema,
  moduleId: uuidSchema.optional(),
  text: z.string(),
  startCodePoint: z.number().int().nonnegative(),
  capturedAt: timestampSchema,
});
export type ChatCitationSnapshot = z.infer<typeof chatCitationSnapshotSchema>;
export const chatCitationResponseSchema = successEnvelopeSchema(chatCitationSnapshotSchema);
export const chatMaterialsQuerySchema = z.object({
  nodeId: uuidSchema.optional(),
  after: uuidSchema.optional(),
});
export const chatMaterialSchema = z.object({
  target: chatMaterialTargetSchema,
  title: z.string(),
  pageNumber: z.number().int().positive().nullable(),
  sectionTitle: z.string().nullable(),
});
export const chatMaterialsResponseSchema = successEnvelopeSchema(
  z.object({
    items: z.array(chatMaterialSchema),
    nextCursor: uuidSchema.nullable(),
  }),
);
export const chatMaterialPreviewInputSchema = z
  .object({
    target: chatMaterialTargetSchema,
    startCodePoint: z.number().int().nonnegative().default(0),
  })
  .strict();
export const chatMaterialPreviewSchema = chatMaterialSchema.extend({
  text: z.string(),
  reference: chatContextReferenceSchema,
  totalCodePoints: z.number().int().positive(),
});
export type ChatMaterialPreview = z.infer<typeof chatMaterialPreviewSchema>;
export const chatMaterialPreviewResponseSchema = successEnvelopeSchema(chatMaterialPreviewSchema);
export const chatTitleSchema = z
  .string()
  .trim()
  .refine(
    (value) => [...value].length >= 1 && [...value].length <= 120,
    "Judul harus berisi 1–120 karakter.",
  );
export const createChatThreadSchema = z
  .object({ title: chatTitleSchema.optional(), moduleId: uuidSchema.nullable().optional() })
  .strict();
export const patchChatThreadSchema = z.object({ title: chatTitleSchema }).strict();
export const chatThreadParamsSchema = z.object({
  moduleId: uuidSchema.optional(),
  threadId: uuidSchema,
});
export const chatRunParamsSchema = chatThreadParamsSchema.extend({ runId: uuidSchema });
export const chatPaginationSchema = z.object({
  cursor: z.string().max(2048).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export const chatScopeSchema = z
  .object({
    moduleId: uuidSchema,
    nodeId: uuidSchema.optional(),
  })
  .strict();
export type ChatScope = z.infer<typeof chatScopeSchema>;
export const chatMentionSchema = chatScopeSchema.extend({
  label: z.string().trim().min(1).max(240),
});
export type ChatMention = z.infer<typeof chatMentionSchema>;
export const chatMessageScopeSchema = z.object({
  mentions: z.array(chatMentionSchema).max(8),
  scopes: z.array(chatScopeSchema).max(8),
});
export const CHAT_ATTACHMENT_MAX_FILES = 5;
export const CHAT_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;
export const CHAT_ATTACHMENT_TOTAL_BYTES = 25 * 1024 * 1024;
export const chatAttachmentTypes = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  txt: "text/plain",
  md: "text/markdown",
  markdown: "text/markdown",
  csv: "text/csv",
} as const;
export const chatAttachmentSchema = z.object({
  id: uuidSchema,
  filename: z.string(),
  mimeType: z.string(),
  size: z.number().int().positive(),
});
export type ChatAttachment = z.infer<typeof chatAttachmentSchema>;
export const chatAttachmentResponseSchema = successEnvelopeSchema(chatAttachmentSchema);
export const chatAttachmentDownloadSchema = successEnvelopeSchema(
  z.object({ url: z.string().url() }),
);
export function chatAttachmentNote(filename: string): string | undefined {
  if (/\.(docx|pptx)$/i.test(filename))
    return "Gambar tertanam mungkin tidak terbaca. Gunakan PDF untuk detail visual.";
  if (/\.xlsx$/i.test(filename))
    return "Pembacaan spreadsheet terbatas; bukan analisis seluruh workbook.";
}
export const sendChatMessageSchema = z
  .object({
    text: z.string().trim().default(""),
    attachmentIds: z
      .array(uuidSchema)
      .max(CHAT_ATTACHMENT_MAX_FILES)
      .refine((ids) => new Set(ids).size === ids.length)
      .optional(),
    mentions: z.array(chatMentionSchema).max(8).optional(),
    pageContext: chatPageContextSchema.optional(),
    references: z.array(chatContextReferenceSchema).default([]),
    retryOfRunId: uuidSchema.optional(),
  })
  .strict()
  .refine(
    (value) => Boolean(value.text || value.attachmentIds?.length),
    "Tulis pesan atau tambahkan lampiran.",
  );
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
export const chatImageSchema = lessonImageSchema.extend({ id: uuidSchema });
export type ChatImage = z.infer<typeof chatImageSchema>;
export const chatImageDownloadSchema = successEnvelopeSchema(z.object({ url: z.url() }));
export const chatWebSearchSchema = z.object({
  status: z.enum(["not_requested", "searching", "completed", "failed"]),
  searches: z.number().int().nonnegative(),
});
export type ChatWebSearchState = z.infer<typeof chatWebSearchSchema>;
// Public parts are persisted before they are streamed.
export const chatPartSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("data-web-search"),
    id: z.literal("web-search"),
    data: chatWebSearchSchema,
  }),
  z.object({ type: z.literal("data-image"), id: uuidSchema, data: chatImageSchema }),
  z.object({ type: z.literal("data-attachment"), id: uuidSchema, data: chatAttachmentSchema }),
  z.object({ type: z.literal("text"), text: z.string() }),
  z.object({ type: z.literal("data-citation"), id: uuidSchema, data: chatCitationSchema }),
  z.object({ type: z.literal("data-run-status"), data: chatRunDataSchema }),
]);
export const chatThreadSchema = z.object({
  id: uuidSchema,
  moduleId: uuidSchema.nullable(),
  moduleTitle: z.string().nullable().optional(),
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
  mentions: z.array(chatMentionSchema).default([]),
  scopes: z.array(chatScopeSchema).default([]),
  references: z.array(chatContextReferenceSchema).default([]),
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
  eventsUrl: z
    .string()
    .regex(
      /^\/api\/v1\/(?:modules\/[0-9a-f-]{36}\/)?chat\/threads\/[0-9a-f-]{36}\/runs\/[0-9a-f-]{36}\/events$/i,
    ),
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
