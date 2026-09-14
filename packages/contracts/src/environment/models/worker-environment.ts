import { z } from "zod";
import { infrastructureEnvSchema } from "./infrastructure-environment.js";
import { knowledgeEnvironment } from "./knowledge-environment.js";

export const workerEnvSchema = infrastructureEnvSchema.extend({
  ...knowledgeEnvironment,
  OPENAI_API_KEY: z.string().min(1),
  AI_IMAGE_INPUT_ENABLED: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .default(true),
  WIKIMEDIA_USER_AGENT: z.string().min(1).default("NgertiinLessonImages/1.0 (https://ngerti.in)"),
  OPENAI_MODEL: z.string().min(1),
  MISTRAL_API_KEY: z.string().min(1),
  MISTRAL_OCR_MODEL: z.string().min(1).default("mistral-ocr-latest"),
  FIRECRAWL_API_KEY: z.string().min(1),
  SOURCE_URL_MAX_CODE_POINTS: z.coerce.number().int().positive().default(500_000),
});

export type WorkerEnvironment = z.infer<typeof workerEnvSchema>;
