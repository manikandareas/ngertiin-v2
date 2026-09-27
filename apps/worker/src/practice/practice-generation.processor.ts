import { randomUUID } from "node:crypto";
import type { Mistral } from "@mistralai/mistralai";
import {
  Inject,
  Injectable,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from "@nestjs/common";
import {
  LANGUAGE_OPTIONS,
  practiceConfigurationSchema,
  practiceItemContentSchema,
  practiceItemKeySchema,
} from "@ngertiin/contracts/api";
import type { WorkerEnvironment } from "@ngertiin/contracts/environment";
import { type PracticeGenerationJob, practiceGenerationJobSchema } from "@ngertiin/contracts/jobs";
import {
  practice_generation_runs,
  practice_items,
  practice_sets,
  practice_sources,
} from "@ngertiin/database";
import { QUEUE_NAMES } from "@ngertiin/shared";
import { processOcr } from "@ngertiin/shared/ocr";
import { Worker as BullWorker, type Job } from "bullmq";
import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { AiService } from "../ai/ai.service.js";
import { WORKER_ENV } from "../config.js";
import { InfrastructureService } from "../infrastructure/infrastructure.service.js";
import { OCR_CLIENT } from "../ocr/ocr.service.js";

const cardSchema = z
  .object({
    front: z.string().min(1),
    back: z.string().min(1),
    sourcePosition: z.number().int().positive(),
  })
  .strict();
const questionSchema = z
  .object({
    type: z.enum(["multiple_choice", "true_false", "short_answer"]),
    question: z.string().min(1),
    options: z.array(z.string()).nullable(),
    correctOptionIndex: z.number().int().nonnegative().nullable(),
    correctValue: z.boolean().nullable(),
    rubric: z
      .array(
        z.object({ criterion: z.string().min(1), weight: z.number().positive().max(1) }).strict(),
      )
      .nullable(),
    exampleAnswer: z.string().nullable(),
    explanation: z.string().min(1),
    sourcePosition: z.number().int().positive(),
  })
  .strict();
const outputSchema = z
  .object({ cards: z.array(cardSchema), questions: z.array(questionSchema) })
  .strict();
type StoredItem = {
  id: string;
  content: z.infer<typeof practiceItemContentSchema>;
  key: z.infer<typeof practiceItemKeySchema>;
  sourcePosition: number;
};

@Injectable()
export class PracticeGenerationProcessor implements OnApplicationBootstrap, OnApplicationShutdown {
  private worker?: BullWorker<PracticeGenerationJob>;
  private timer?: ReturnType<typeof setInterval>;
  constructor(
    @Inject(InfrastructureService) private readonly infrastructure: InfrastructureService,
    @Inject(AiService) private readonly ai: AiService,
    @Inject(OCR_CLIENT) private readonly ocr: Pick<Mistral, "ocr">,
    @Inject(WORKER_ENV) private readonly environment: WorkerEnvironment,
  ) {}
  private get db() {
    return this.infrastructure.database.db;
  }

  onApplicationBootstrap() {
    this.worker = new BullWorker(QUEUE_NAMES.practiceGeneration, (job) => this.process(job), {
      connection: this.infrastructure.redis,
      concurrency: 1,
    });
    this.worker.on("error", (error) =>
      console.error(
        JSON.stringify({ event: "practice.generation_worker_error", errorType: error.name }),
      ),
    );
    this.timer = setInterval(
      () =>
        void this.dispatch().catch((error) =>
          console.error(
            JSON.stringify({
              event: "practice.generation_dispatch_error",
              errorType: error instanceof Error ? error.name : "unknown",
            }),
          ),
        ),
      5_000,
    );
    this.timer.unref();
    void this.dispatch();
  }
  async onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
    await this.worker?.close();
  }

  private async dispatch() {
    const runs = await this.db
      .select({ id: practice_generation_runs.id, practiceId: practice_generation_runs.practice_id })
      .from(practice_generation_runs)
      .where(inArray(practice_generation_runs.status, ["queued", "processing"]))
      .orderBy(asc(practice_generation_runs.created_at))
      .limit(50);
    for (const run of runs)
      await this.infrastructure.ensureJob({
        queue: this.infrastructure.practiceGenerationQueue,
        name: "generate",
        data: { runId: run.id, practiceId: run.practiceId },
        jobId: run.id,
        options: {
          attempts: 3,
          backoff: { type: "exponential", delay: 5_000 },
          removeOnComplete: true,
          removeOnFail: true,
        },
      });
  }

  private async process(job: Job<PracticeGenerationJob>) {
    const { runId, practiceId } = practiceGenerationJobSchema.parse(job.data);
    const [run] = await this.db
      .select()
      .from(practice_generation_runs)
      .where(
        and(
          eq(practice_generation_runs.id, runId),
          eq(practice_generation_runs.practice_id, practiceId),
        ),
      );
    const [set] = await this.db
      .select()
      .from(practice_sets)
      .where(eq(practice_sets.id, practiceId));
    if (!run || !set || run.status === "completed" || set.status === "ready") return;
    const configuration = practiceConfigurationSchema.parse(set.configuration);
    await this.db
      .update(practice_generation_runs)
      .set({
        status: "processing",
        attempt_count: Math.min(3, job.attemptsMade + 1),
        started_at: run.started_at ?? new Date(),
        bullmq_job_id: job.id,
      })
      .where(eq(practice_generation_runs.id, runId));
    try {
      const sources = await this.db
        .select()
        .from(practice_sources)
        .where(eq(practice_sources.practice_id, practiceId))
        .orderBy(practice_sources.position);
      const sourceTexts: string[] = [];
      for (const source of sources) {
        let content = source.snapshot_text;
        if (!content.trim() && source.object_key && source.mime_type) {
          const binary = await this.infrastructure.storage.get(source.object_key);
          if (source.mime_type.startsWith("text/")) content = Buffer.from(binary).toString("utf8");
          else {
            const result = await processOcr(this.ocr, {
              model: this.environment.MISTRAL_OCR_MODEL,
              binary,
              mimeType: source.mime_type,
            });
            content = result.pages.map((page) => page.markdown).join("\n\n");
          }
          if (content.trim())
            await this.db
              .update(practice_sources)
              .set({ snapshot_text: content })
              .where(eq(practice_sources.id, source.id));
        }
        sourceTexts.push(content);
      }
      const material = sourceTexts
        .map((content, index) => `[${sources[index].position}] ${content}`)
        .join("\n\n");
      if (material.trim().length < 200)
        throw new Error("Materi tidak cukup untuk jumlah minimum. Pilih sumber atau fokus lain.");
      const batches = Array.isArray(run.batches_json) ? (run.batches_json as StoredItem[][]) : [];
      if (batches.some((batch) => !Array.isArray(batch) || batch.length < 1 || batch.length > 10))
        throw new Error("Checkpoint batch tidak valid.");
      const items = batches.flat();
      for (const item of items) {
        practiceItemContentSchema.parse(item.content);
        practiceItemKeySchema.parse(item.key);
        if (item.content.type !== item.key.type)
          throw new Error("Checkpoint kunci tidak cocok dengan soal.");
        if (!sources.some((source) => source.position === item.sourcePosition))
          throw new Error("Checkpoint sumber tidak valid.");
      }
      if (new Set(items.map((item) => item.id)).size !== items.length)
        throw new Error("Checkpoint identitas item berulang.");
      const batchCount = Math.ceil(configuration.itemCount / 10);
      for (let batchIndex = batches.length; batchIndex < batchCount; batchIndex++) {
        const count = Math.min(10, configuration.itemCount - items.length);
        const remaining = configuration.composition
          ? {
              multiple_choice:
                configuration.composition.multipleChoice -
                items.filter((item) => item.content.type === "multiple_choice").length,
              true_false:
                configuration.composition.trueFalse -
                items.filter((item) => item.content.type === "true_false").length,
              short_answer:
                configuration.composition.shortAnswer -
                items.filter((item) => item.content.type === "short_answer").length,
            }
          : null;
        const counts: Record<string, number> | null = remaining
          ? { multiple_choice: 0, true_false: 0, short_answer: 0 }
          : null;
        if (counts && remaining) {
          const available = { ...remaining };
          for (let slot = 0; slot < count; slot++) {
            const kind = (Object.keys(available) as Array<keyof typeof available>).sort(
              (a, b) => available[b] - available[a],
            )[0];
            if (!kind || available[kind] <= 0)
              throw new Error("Komposisi melebihi jumlah yang tersisa.");
            counts[kind]++;
            available[kind]--;
          }
        }
        const segmentSize = Math.max(1_000, Math.floor(24_000 / sourceTexts.length));
        const segment = sourceTexts
          .map((source, index) => {
            const start = (batchIndex * segmentSize) % source.length;
            return `[${sources[index].position}] ${source.slice(start, start + segmentSize) || source.slice(0, segmentSize)}`;
          })
          .join("\n\n");
        const output = await this.ai.generateObject({
          schema: outputSchema,
          schemaName: "practice_batch",
          operation: "practice_generation",
          prompt: `Buat ${count} item latihan yang berbeda berdasarkan sumber di bawah. Jenis: ${configuration.kind}. Fokus: ${configuration.focus}. Bahasa: ${LANGUAGE_OPTIONS[configuration.language].label}. Kesulitan: ${configuration.difficulty}. Komposisi soal batch: ${JSON.stringify(counts)}. Untuk flashcard isi cards saja; untuk kuis/exam isi questions saja. Semua item wajib menunjuk nomor sumber yang benar. Jangan membuat soal yang tidak didukung materi. Setiap rubrik esai berbobot total 1. Materi:\n${segment}`,
        });
        const generated: StoredItem[] =
          configuration.kind === "flashcard"
            ? output.cards.map((card) => ({
                id: randomUUID(),
                content: practiceItemContentSchema.parse({
                  type: "flashcard",
                  front: card.front,
                  back: card.back,
                }),
                key: practiceItemKeySchema.parse({ type: "flashcard" }),
                sourcePosition: card.sourcePosition,
              }))
            : output.questions.map((question) => {
                const content = practiceItemContentSchema.parse(
                  question.type === "multiple_choice"
                    ? {
                        type: question.type,
                        question: question.question,
                        options: question.options,
                      }
                    : { type: question.type, question: question.question },
                );
                const key = practiceItemKeySchema.parse(
                  question.type === "multiple_choice"
                    ? {
                        type: question.type,
                        optionIndex: question.correctOptionIndex,
                        explanation: question.explanation,
                      }
                    : question.type === "true_false"
                      ? {
                          type: question.type,
                          value: question.correctValue,
                          explanation: question.explanation,
                        }
                      : {
                          type: question.type,
                          rubric: question.rubric,
                          exampleAnswer: question.exampleAnswer,
                          explanation: question.explanation,
                        },
                );
                if (
                  content.type === "multiple_choice" &&
                  key.type === "multiple_choice" &&
                  key.optionIndex >= content.options.length
                )
                  throw new Error("Kunci pilihan di luar opsi.");
                if (
                  content.type === "multiple_choice" &&
                  new Set(content.options).size !== content.options.length
                )
                  throw new Error("Pilihan jawaban berulang.");
                if (
                  key.type === "short_answer" &&
                  Math.abs(key.rubric.reduce((sum, criterion) => sum + criterion.weight, 0) - 1) >
                    0.001
                )
                  throw new Error("Bobot rubrik tidak valid.");
                return { id: randomUUID(), content, key, sourcePosition: question.sourcePosition };
              });
        if (
          generated.length !== count ||
          (configuration.kind === "flashcard"
            ? output.questions.length !== 0
            : output.cards.length !== 0)
        )
          throw new Error("Jumlah item dari provider tidak sesuai.");
        if (
          generated.some(
            (item) => !sources.some((source) => source.position === item.sourcePosition),
          )
        )
          throw new Error("Referensi sumber tidak valid.");
        const fingerprint = (item: StoredItem) =>
          JSON.stringify(item.content).toLowerCase().replace(/\s+/g, " ");
        const seen = new Set(items.map(fingerprint));
        for (const item of generated) {
          const value = fingerprint(item);
          if (seen.has(value)) throw new Error("Item latihan berulang.");
          seen.add(value);
        }
        if (counts)
          for (const [kind, amount] of Object.entries(counts))
            if (generated.filter((item) => item.content.type === kind).length !== amount)
              throw new Error("Komposisi soal tidak sesuai.");
        batches.push(generated);
        items.push(...generated);
        await this.db
          .update(practice_generation_runs)
          .set({
            batches_json: batches,
            progress: Math.floor((items.length / configuration.itemCount) * 90),
          })
          .where(eq(practice_generation_runs.id, runId));
      }
      if (items.length !== configuration.itemCount)
        throw new Error("Jumlah akhir latihan tidak sesuai.");
      if (configuration.composition) {
        const expected = {
          multiple_choice: configuration.composition.multipleChoice,
          true_false: configuration.composition.trueFalse,
          short_answer: configuration.composition.shortAnswer,
        };
        for (const [kind, count] of Object.entries(expected))
          if (items.filter((item) => item.content.type === kind).length !== count)
            throw new Error("Komposisi akhir latihan tidak sesuai.");
      }
      await this.db.transaction(async (tx) => {
        const [locked] = await tx
          .select()
          .from(practice_sets)
          .where(eq(practice_sets.id, practiceId))
          .for("update");
        if (!locked || locked.status === "ready") return;
        await tx
          .insert(practice_items)
          .values(
            items.map((item, index) => ({
              id: item.id,
              practice_id: practiceId,
              position: index + 1,
              content: item.content,
              private_key: item.key,
              source_refs: [item.sourcePosition],
            })),
          )
          .onConflictDoNothing();
        await tx
          .update(practice_sets)
          .set({ status: "ready", updated_at: new Date() })
          .where(eq(practice_sets.id, practiceId));
        await tx
          .update(practice_generation_runs)
          .set({ status: "completed", progress: 100, finished_at: new Date(), failure: null })
          .where(eq(practice_generation_runs.id, runId));
      });
    } catch (error) {
      if (job.attemptsMade + 1 >= 3) {
        await this.db.transaction(async (tx) => {
          await tx
            .update(practice_generation_runs)
            .set({
              status: "failed",
              failure: { message: error instanceof Error ? error.message : "Generation gagal." },
              finished_at: new Date(),
            })
            .where(eq(practice_generation_runs.id, runId));
          await tx
            .update(practice_sets)
            .set({ status: "failed", updated_at: new Date() })
            .where(eq(practice_sets.id, practiceId));
        });
      }
      throw error;
    }
  }
}
