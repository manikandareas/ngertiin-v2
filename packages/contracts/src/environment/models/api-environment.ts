import { z } from "zod";
import { infrastructureEnvSchema } from "./infrastructure-environment.js";

export const apiEnvSchema = infrastructureEnvSchema.extend({
  API_PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  WEB_ORIGIN: z.string().url(),
  CLERK_SECRET_KEY: z.string().min(1),
});

export type ApiEnvironment = z.infer<typeof apiEnvSchema>;
