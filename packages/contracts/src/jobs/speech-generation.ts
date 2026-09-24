import { z } from "zod";
import { uuidSchema } from "../api/common/identifiers.js";

export const speechGenerationJobSchema = z.object({ assetId: uuidSchema }).strict();
export type SpeechGenerationJob = z.infer<typeof speechGenerationJobSchema>;
