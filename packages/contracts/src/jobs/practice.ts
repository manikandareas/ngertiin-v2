import { z } from "zod";
import { uuidSchema } from "../api/common/identifiers.js";

export const practiceGenerationJobSchema = z
  .object({ runId: uuidSchema, practiceId: uuidSchema })
  .strict();
export const practiceEvaluationJobSchema = z.object({ attemptId: uuidSchema }).strict();
export type PracticeGenerationJob = z.infer<typeof practiceGenerationJobSchema>;
export type PracticeEvaluationJob = z.infer<typeof practiceEvaluationJobSchema>;
