import { z } from "zod";
import { infrastructureEnvSchema } from "./infrastructure-environment.js";
import { knowledgeEnvironment } from "./knowledge-environment.js";

export const apiEnvSchema = infrastructureEnvSchema
  .extend({
    ...knowledgeEnvironment,
    USAGE_MODULES_WEEKLY_LIMIT: z.coerce.number().int().positive().default(10),
    USAGE_SOURCES_WEEKLY_LIMIT: z.coerce.number().int().positive().default(40),
    OPENAI_API_KEY: z.string().trim().min(1),
    OPENAI_CHAT_MODEL: z.string().trim().min(1),
    CHAT_CONTEXT_MAX_REFERENCES: z.coerce.number().int().positive().default(5),
    CHAT_CONTEXT_MAX_CODE_POINTS: z.coerce.number().int().min(1000).default(12000),
    CHAT_INPUT_MAX_CODE_POINTS: z.coerce.number().int().positive().default(8000),
    CHAT_PROMPT_MAX_TOKENS: z.coerce.number().int().positive().default(16000),
    CHAT_OUTPUT_MAX_TOKENS: z.coerce.number().int().positive().default(2048),
    CHAT_RUN_TIMEOUT_MS: z.coerce.number().int().positive().default(120000),
    CHAT_PROVIDER_TIMEOUT_MS: z.coerce.number().int().positive().default(60000),
    CHAT_PROVIDER_MAX_RETRIES: z.coerce.number().int().min(0).max(1).default(1),
    CHAT_AGENT_MAX_STEPS: z.coerce.number().int().positive().default(6),
    CHAT_TOOL_MAX_CALLS: z.coerce.number().int().positive().default(8),
    CHAT_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(10),
    CHAT_MAX_ACTIVE_RUNS_PER_USER: z.coerce.number().int().positive().default(2),
    CHAT_MAX_ACTIVE_RUNS_GLOBAL: z.coerce.number().int().positive().default(20),
    CHAT_CANCEL_POLL_MS: z.coerce.number().int().positive().default(1000),
    CHAT_CANCEL_GRACE_MS: z.coerce.number().int().positive().default(5000),
    CHAT_STREAM_BUFFER_MAX_BYTES: z.coerce.number().int().positive().default(262144),
    CHAT_MAX_EXECUTING_RUNS_PER_INSTANCE: z.coerce.number().int().positive().default(4),
    CHAT_LEASE_MS: z.coerce.number().int().positive().default(30000),
    CHAT_HEARTBEAT_MS: z.coerce.number().int().positive().default(5000),
    CHAT_SWEEP_INTERVAL_MS: z.coerce.number().int().positive().default(5000),
    CHAT_SNAPSHOT_INTERVAL_MS: z.coerce.number().int().positive().default(500),
    CHAT_IDEMPOTENCY_RETENTION_HOURS: z.coerce.number().int().positive().default(168),
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
  })
  .superRefine((value, context) => {
    if (value.CHAT_HEARTBEAT_MS >= value.CHAT_LEASE_MS / 3)
      context.addIssue({
        code: "custom",
        path: ["CHAT_HEARTBEAT_MS"],
        message: "Heartbeat must be less than lease / 3.",
      });
  });

export type ApiEnvironment = z.infer<typeof apiEnvSchema>;
