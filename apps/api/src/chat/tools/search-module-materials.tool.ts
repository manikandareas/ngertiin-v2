import { tool } from "@langchain/core/tools";
import { MATERIAL_EXCERPT_PADDING } from "@ngertiin/shared/knowledge";
import { z } from "zod";
import type { KnowledgeService } from "../../knowledge/knowledge.service.js";
import type { LearningContext, LearningEvidence } from "../learning.context.js";
export function searchModuleMaterialsTool(
  knowledge: KnowledgeService,
  context: LearningContext,
  evidence: LearningEvidence,
  maxQueryCodePoints = 8000,
) {
  return tool(
    async ({ query }) => {
      const remaining = evidence.remainingCodePoints(context.maxContextCodePoints);
      if (remaining <= 2 * MATERIAL_EXCERPT_PADDING)
        return { error: "CONTEXT_LIMIT", message: "Anggaran kutipan sudah penuh." };
      const results = await Promise.all(
        context.scopes.map((scope) =>
          knowledge.search(
            context.userId,
            scope.moduleId,
            query,
            Math.floor(remaining / context.scopes.length),
            scope.nodeId,
          ),
        ),
      );
      return {
        status: results.some((result) => result.status === "INDEX_NOT_READY")
          ? "INDEX_NOT_READY"
          : "ready",
        degraded: results.some((result) => result.degraded),
        snapshots: results
          .flatMap((result) => result.snapshots)
          .filter((snapshot) => evidence.tryAdd(snapshot, context.maxContextCodePoints)),
      };
    },
    {
      name: "search_module_materials",
      description:
        "Cari bukti lintas materi modul saat kutipan dan history belum cukup. Scope ditentukan server. Jangan gunakan untuk sapaan.",
      schema: z.object({
        query: z
          .string()
          .trim()
          .min(1)
          .refine((value) => [...value].length <= maxQueryCodePoints),
      }),
    },
  );
}
