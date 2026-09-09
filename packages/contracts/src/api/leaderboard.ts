import { z } from "zod";
import { successEnvelopeSchema } from "./common/identifiers.js";

export const leaderboardParticipantSchema = z.object({
  userId: z.uuid(),
  displayName: z.string().min(1),
  avatarUrl: z.url(),
  score: z.number().int().positive(),
  rank: z.number().int().positive(),
});
export const leaderboardSchema = z.object({
  serverTime: z.iso.datetime(),
  inactivityDays: z.literal(7),
  nextExpiresAt: z.iso.datetime().nullable(),
  participants: z.array(leaderboardParticipantSchema).max(50),
  self: z.object({
    userId: z.uuid(),
    score: z.number().int().nonnegative(),
    rank: z.number().int().positive().nullable(),
    expiresAt: z.iso.datetime().nullable(),
  }),
});
export const getLeaderboardResponseSchema = successEnvelopeSchema(leaderboardSchema);
export type Leaderboard = z.infer<typeof leaderboardSchema>;
export type GetLeaderboardResponse = z.infer<typeof getLeaderboardResponseSchema>;
