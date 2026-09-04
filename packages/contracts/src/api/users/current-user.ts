import { z } from "zod";
import { successEnvelopeSchema, uuidSchema } from "../common/identifiers.js";

function isIanaTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

export const ianaTimezoneSchema = z
  .string()
  .refine(isIanaTimezone, "Expected a valid IANA timezone.");

export const userStatsSchema = z.object({
  totalXp: z.number(),
  currentStreak: z.number(),
  longestStreak: z.number(),
  lastLearningDate: z.string().date().nullable(),
});

export const currentUserSchema = z.object({
  id: uuidSchema,
  displayName: z.string().nullable(),
  timezone: ianaTimezoneSchema,
  stats: userStatsSchema,
});

export const patchCurrentUserBodySchema = z
  .object({
    displayName: z.string().nullable().optional(),
    timezone: ianaTimezoneSchema.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.displayName === undefined && value.timezone === undefined) {
      context.addIssue({
        code: "custom",
        message: "At least one profile field must be supplied.",
      });
    }
  });

export const getCurrentUserResponseSchema = successEnvelopeSchema(currentUserSchema);
export const patchCurrentUserResponseSchema = successEnvelopeSchema(currentUserSchema);

export type CurrentUser = z.infer<typeof currentUserSchema>;
export type UserStats = z.infer<typeof userStatsSchema>;
export type PatchCurrentUserBody = z.infer<typeof patchCurrentUserBodySchema>;
export type GetCurrentUserResponse = z.infer<typeof getCurrentUserResponseSchema>;
export type PatchCurrentUserResponse = z.infer<typeof patchCurrentUserResponseSchema>;
