import { tool } from "@langchain/core/tools";
import { z } from "zod";
import type { ModulesService } from "../../modules/modules.service.js";
import type { LearningContext } from "../learning.context.js";
export function readProgressTool(modules: ModulesService, context: LearningContext) {
  return tool(
    () =>
      Promise.all(
        [...new Set(context.scopes.map((scope) => scope.moduleId))].map(async (moduleId) => ({
          moduleId,
          progress: await modules.readChatProgress(context.userId, moduleId),
        })),
      ),
    {
      name: "read_progress",
      description:
        "Baca ringkasan progres dan status node pengguna pada modul ini. Tidak membaca jawaban atau isi assessment.",
      schema: z.object({}).strict(),
    },
  );
}
