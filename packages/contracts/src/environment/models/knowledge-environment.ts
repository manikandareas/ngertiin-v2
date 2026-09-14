import { z } from "zod";

export const knowledgeEnvironment = {
  OPENAI_EMBEDDING_MODEL: z.string().min(1).default("text-embedding-3-small"),
  OPENAI_EMBEDDING_DIMENSIONS: z.coerce
    .number()
    .int()
    .refine((value) => value === 1536, "A dimension change requires a new vector migration.")
    .default(1536),
  KNOWLEDGE_INDEX_VERSION: z.coerce.number().int().positive().default(1),
  KNOWLEDGE_CHUNK_TOKENS: z.coerce.number().int().min(100).max(2000).default(600),
  KNOWLEDGE_CHUNK_OVERLAP_TOKENS: z.coerce.number().int().nonnegative().max(99).default(80),
  KNOWLEDGE_SEARCH_CANDIDATES: z.coerce.number().int().positive().max(100).default(20),
  KNOWLEDGE_SEARCH_TOP_K: z.coerce.number().int().positive().max(20).default(6),
  KNOWLEDGE_RRF_K: z.coerce.number().int().positive().default(60),
  KNOWLEDGE_EMBEDDING_BATCH_SIZE: z.coerce.number().int().positive().max(32).default(32),
  KNOWLEDGE_INDEX_CONCURRENCY: z.coerce.number().int().positive().max(8).default(2),
  KNOWLEDGE_RECONCILE_INTERVAL_MS: z.coerce.number().int().min(1000).default(60000),
  KNOWLEDGE_OBSOLETE_RETENTION_HOURS: z.coerce.number().int().positive().default(24),
};
