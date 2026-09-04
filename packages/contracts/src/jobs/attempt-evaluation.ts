import { z } from "zod";
import { uuidSchema } from "../api/common/identifiers.js";

export const attemptEvaluationJobSchema = z.object({ attemptId: uuidSchema }).strict();

export type AttemptEvaluationJob = z.infer<typeof attemptEvaluationJobSchema>;
