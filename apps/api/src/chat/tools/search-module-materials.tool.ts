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
      const result = await knowledge.search(context.userId, context.moduleId, query, remaining);
      let message: string | undefined;
      if (result.status === "INDEX_NOT_READY") {
        message = "Indeks belum lengkap. Jelaskan keterbatasan bukti yang tersedia.";
      } else if (result.degraded) {
        message =
          "Pencarian terbatas pada kata kunci karena embedding tidak tersedia. Sebutkan keterbatasan ini.";
      }
      return {
        status: result.status,
        degraded: result.degraded,
        message,
        snapshots: result.snapshots.filter((snapshot) =>
          evidence.tryAdd(snapshot, context.maxContextCodePoints),
        ),
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
