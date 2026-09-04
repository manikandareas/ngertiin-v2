import { infrastructureEnvSchema } from "./infrastructure-environment.js";
import { z } from "zod";

export const workerEnvSchema = infrastructureEnvSchema.extend({
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_MODEL: z.string().min(1),
});

export type WorkerEnvironment = z.infer<typeof workerEnvSchema>;
