import { tool } from "@langchain/core/tools";
import { interrupt } from "@langchain/langgraph";
import {
  chatInteractionQuestionSchema,
  practiceConfigurationSchema,
} from "@ngertiin/contracts/api";
import { z } from "zod";
import { ProductError } from "../../http/product-error.js";
import type { PracticeService } from "../../practice/practice.service.js";

export function askUserTool() {
  return tool(
    ({ questions }) => {
      const answer = interrupt({ kind: "ask_user", questions });
      return JSON.stringify(answer);
    },
    {
      name: "ask_user",
      description:
        "Tanyakan informasi wajib yang belum jelas sebelum mengusulkan latihan. Maksimal tiga pertanyaan pendek.",
      schema: z
        .object({ questions: z.array(chatInteractionQuestionSchema).min(1).max(3) })
        .strict(),
    },
  );
}

export function createPracticeTool(
  practice: PracticeService,
  userId: string,
  approvedInteractionId: string | null,
) {
  return tool(
    async (input) => {
      if (!approvedInteractionId) throw new Error("Practice requires approved interaction");
      try {
        const set = await practice.createApproved(
          userId,
          approvedInteractionId,
          approvedInteractionId,
          input,
        );
        return JSON.stringify({ practiceId: set.id, moduleId: set.moduleId, status: set.status });
      } catch (error) {
        if (!(error instanceof ProductError)) throw error;
        return JSON.stringify({
          error: error.code,
          detail: error.detail,
          nextStep:
            "Jangan klaim latihan sudah dibuat. Periksa sumber terbaru, minta klarifikasi bila perlu, lalu ajukan create_practice lagi untuk persetujuan baru.",
        });
      }
    },
    {
      name: "create_practice",
      description:
        "Buat flashcard, kuis, atau exam setelah pengguna menyetujui konfigurasi. Semua materi harus berasal dari modul atau lampiran terpilih.",
      schema: practiceConfigurationSchema,
    },
  );
}
