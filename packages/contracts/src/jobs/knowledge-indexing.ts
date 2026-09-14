import { z } from "zod";
export const knowledgeIndexingJobSchema = z
  .object({
    documentId: z.uuid(),
    indexVersionId: z.number().int().positive(),
    contentRevision: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();
export type KnowledgeIndexingJob = z.infer<typeof knowledgeIndexingJobSchema>;
export const knowledgeJobId = (job: KnowledgeIndexingJob): string =>
  `knowledge-${job.documentId}-${job.indexVersionId}-${job.contentRevision}`;
