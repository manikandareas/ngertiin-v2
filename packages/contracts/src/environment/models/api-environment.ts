import { z } from "zod";
import { infrastructureEnvSchema } from "./infrastructure-environment.js";

export const apiEnvSchema = infrastructureEnvSchema.extend({
  API_PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  WEB_ORIGIN: z.string().url(),
  CLERK_SECRET_KEY: z.string().min(1),
  SOURCE_PDF_MAX_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .max(25 * 1024 * 1024)
    .default(25 * 1024 * 1024),
  RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_READ_MAX: z.coerce.number().int().positive().default(120),
  RATE_LIMIT_MUTATION_MAX: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_EXPENSIVE_MAX: z.coerce.number().int().positive().default(10),
  RATE_LIMIT_STREAM_MAX: z.coerce.number().int().positive().default(10),
});

export type ApiEnvironment = z.infer<typeof apiEnvSchema>;
