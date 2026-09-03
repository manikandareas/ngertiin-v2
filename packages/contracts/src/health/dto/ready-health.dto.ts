import { z } from "zod";
import { dependencyStateSchema } from "../models/dependency-state.js";

export const readyHealthSchema = z.object({
  status: z.enum(["ok", "error"]),
  service: z.literal("api"),
  dependencies: z.object({
    postgres: dependencyStateSchema,
    redis: dependencyStateSchema,
    storage: dependencyStateSchema,
  }),
});

export type ReadyHealth = z.infer<typeof readyHealthSchema>;
