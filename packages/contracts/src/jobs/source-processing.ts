import { z } from "zod";

export const sourceProcessingJobSchema = z
  .object({
    processingRunId: z.string().uuid(),
    sourceId: z.string().uuid(),
  })
  .strict();

export type SourceProcessingJob = z.infer<typeof sourceProcessingJobSchema>;
