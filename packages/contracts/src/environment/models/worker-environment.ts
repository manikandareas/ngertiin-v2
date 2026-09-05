import { infrastructureEnvSchema } from "./infrastructure-environment.js";
import { z } from "zod";

export const workerEnvSchema = infrastructureEnvSchema.extend({
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_MODEL: z.string().min(1),
  MISTRAL_API_KEY: z.string().min(1),
  MISTRAL_OCR_MODEL: z.string().min(1).default("mistral-ocr-latest"),
  FIRECRAWL_API_KEY: z.string().min(1),
  SOURCE_URL_MAX_CODE_POINTS: z.coerce.number().int().positive().default(500_000),
});

export type WorkerEnvironment = z.infer<typeof workerEnvSchema>;
