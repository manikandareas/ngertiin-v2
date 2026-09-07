import { z } from "zod";
import { successEnvelopeSchema, timestampSchema, uuidSchema } from "./common/identifiers.js";

const quotaSchema = z.object({
  limit: z.number().int().positive(),
  used: z.number().int().nonnegative(),
  remaining: z.number().int().nonnegative(),
});
export const usageSchema = z.object({
  periodStart: timestampSchema,
  resetAt: timestampSchema,
  timezone: z.literal("Asia/Jakarta"),
  modules: quotaSchema,
  sources: quotaSchema,
  activeModuleId: uuidSchema.nullable(),
});
export const usageResponseSchema = successEnvelopeSchema(usageSchema);
export type Usage = z.infer<typeof usageSchema>;
