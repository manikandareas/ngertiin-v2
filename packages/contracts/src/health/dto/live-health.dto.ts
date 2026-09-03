import { z } from "zod";

export const liveHealthSchema = z.object({
  status: z.literal("ok"),
  service: z.literal("api"),
});

export type LiveHealth = z.infer<typeof liveHealthSchema>;
