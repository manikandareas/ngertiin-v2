import { tool } from "@langchain/core/tools";
import { chatContextReferenceSchema } from "@ngertiin/contracts/api";
import { ProductError } from "../../http/product-error.js";
import type { KnowledgeService } from "../../knowledge/knowledge.service.js";
import type { LearningContext, LearningEvidence } from "../learning.context.js";
export function readExcerptTool(
  knowledge: KnowledgeService,
  context: LearningContext,
  evidence: LearningEvidence,
) {
  return tool(
    async (reference) => {
      try {
        const remaining = evidence.remainingCodePoints(context.maxContextCodePoints);
        if (remaining <= 0)
          return { error: "CONTEXT_LIMIT", message: "Anggaran kutipan sudah penuh." };
        const snapshot = await knowledge.readExcerpt(
          context.userId,
          context.moduleId,
          reference,
          remaining,
        );
        if (!evidence.tryAdd(snapshot, context.maxContextCodePoints))
          return { error: "CONTEXT_LIMIT", message: "Anggaran kutipan sudah penuh." };
        return snapshot;
      } catch (error) {
        if (error instanceof ProductError)
          return {
            error: "CONTEXT_UNAVAILABLE",
            message: "Kutipan tidak tersedia dalam akses dan versi ini.",
          };
        throw error;
      }
    },
    {
      name: "read_excerpt",
      description:
        "Baca rentang tambahan dari referensi materi yang tersedia. Gunakan ID dan revision yang diberikan server; jangan menebak identifier.",
      schema: chatContextReferenceSchema,
    },
  );
}
