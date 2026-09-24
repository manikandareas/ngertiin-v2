import { z } from "zod";
import { successEnvelopeSchema, uuidSchema } from "../common/identifiers.js";

export const lessonSpeechParamsSchema = z.object({
  moduleId: uuidSchema,
  nodeId: uuidSchema,
  activityId: uuidSchema,
});
export type LessonSpeechParams = z.infer<typeof lessonSpeechParamsSchema>;

export const speechAssetSchema = z.object({
  status: z.enum(["queued", "processing", "ready", "failed"]),
  url: z.url().nullable(),
  timeline: z
    .array(z.object({ id: z.string(), text: z.string(), start: z.number(), end: z.number() }))
    .nullable(),
});
export type SpeechAsset = z.infer<typeof speechAssetSchema>;
export const speechAssetResponseSchema = successEnvelopeSchema(speechAssetSchema);
export type SpeechAssetResponse = z.infer<typeof speechAssetResponseSchema>;
