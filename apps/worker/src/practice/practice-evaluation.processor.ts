import {
  Inject,
  Injectable,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from "@nestjs/common";
import {
  practiceAttemptSchema,
  practiceItemContentSchema,
  practiceItemKeySchema,
} from "@ngertiin/contracts/api";
import { type PracticeEvaluationJob, practiceEvaluationJobSchema } from "@ngertiin/contracts/jobs";
import { practice_attempts, practice_items, practice_sets } from "@ngertiin/database";
import { awardPracticeCompletion, QUEUE_NAMES } from "@ngertiin/shared";
import { Worker as BullWorker, type Job } from "bullmq";
import { and, asc, eq, isNull, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { AiService } from "../ai/ai.service.js";
import { InfrastructureService } from "../infrastructure/infrastructure.service.js";

const gradingSchema = z
  .object({
    answers: z.array(
      z
        .object({
          itemId: z.string(),
          rubricScores: z.array(
            z
              .object({
                rubricIndex: z.number().int().nonnegative(),
                score: z.number().min(0).max(1),
              })
              .strict(),
          ),
          explanation: z.string().min(1).max(2_000),
        })
        .strict(),
    ),
  })
  .strict();

@Injectable()
export class PracticeEvaluationProcessor implements OnApplicationBootstrap, OnApplicationShutdown {
  private worker?: BullWorker<PracticeEvaluationJob>;
  private timer?: ReturnType<typeof setInterval>;
  constructor(
    @Inject(InfrastructureService) private readonly infrastructure: InfrastructureService,
    @Inject(AiService) private readonly ai: AiService,
  ) {}
  private get db() {
    return this.infrastructure.database.db;
  }

  onApplicationBootstrap() {
    this.worker = new BullWorker(QUEUE_NAMES.practiceEvaluation, (job) => this.process(job), {
      connection: this.infrastructure.redis,
      concurrency: 2,
    });
    this.worker.on("error", (error) =>
      console.error(
        JSON.stringify({ event: "practice.evaluation_worker_error", errorType: error.name }),
      ),
    );
    this.timer = setInterval(
      () =>
        void this.dispatch().catch((error) =>
          console.error(
            JSON.stringify({
              event: "practice.evaluation_dispatch_error",
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
    const expired = await this.db
      .select({ id: practice_attempts.id })
      .from(practice_attempts)
      .where(
        and(eq(practice_attempts.status, "active"), lte(practice_attempts.deadline_at, new Date())),
      )
      .orderBy(asc(practice_attempts.deadline_at))
      .limit(50);
    for (const row of expired)
      await this.db
        .update(practice_attempts)
        .set({ status: "evaluating", submitted_at: sql`clock_timestamp()` })
        .where(
          and(
            eq(practice_attempts.id, row.id),
            eq(practice_attempts.status, "active"),
            lte(practice_attempts.deadline_at, new Date()),
          ),
        );
    const pending = await this.db
      .select({ id: practice_attempts.id })
      .from(practice_attempts)
      .where(
        and(eq(practice_attempts.status, "evaluating"), isNull(practice_attempts.evaluated_at)),
      )
      .orderBy(asc(practice_attempts.submitted_at))
      .limit(50);
    for (const row of pending)
      await this.infrastructure.ensureJob({
        queue: this.infrastructure.practiceEvaluationQueue,
        name: "evaluate",
        data: { attemptId: row.id },
        jobId: row.id,
        options: {
          attempts: 3,
          backoff: { type: "exponential", delay: 5_000 },
          removeOnComplete: true,
          removeOnFail: true,
        },
      });
  }

  private async process(job: Job<PracticeEvaluationJob>) {
    const { attemptId } = practiceEvaluationJobSchema.parse(job.data);
    const [attempt] = await this.db
      .select()
      .from(practice_attempts)
      .where(eq(practice_attempts.id, attemptId));
    if (attempt?.status !== "evaluating" || attempt.evaluated_at) return;
    const [set] = await this.db
      .select()
      .from(practice_sets)
      .where(eq(practice_sets.id, attempt.practice_id));
    if (!set) throw new Error("Missing Practice set");
    const items = await this.db
      .select()
      .from(practice_items)
      .where(eq(practice_items.practice_id, set.id))
      .orderBy(practice_items.position);
    const answers = practiceAttemptSchema.shape.answers.parse(attempt.answers);
    const results = items.map((item) => {
      const content = practiceItemContentSchema.parse(item.content);
      const key = practiceItemKeySchema.parse(item.private_key);
      if (content.type !== key.type) throw new Error("Practice key does not match item");
      const answer = answers[item.id];
      const score =
        key.type === "flashcard"
          ? answer?.type === "flashcard"
            ? 1
            : 0
          : key.type === "multiple_choice"
            ? answer?.type === "multiple_choice" && answer.optionIndex === key.optionIndex
              ? 1
              : 0
            : key.type === "true_false"
              ? answer?.type === "true_false" && answer.value === key.value
                ? 1
                : 0
              : 0;
      return {
        itemId: item.id,
        score,
        explanation: key.type === "flashcard" ? "" : key.explanation,
      };
    });
    try {
      const essays = items.filter((item) => {
        const answer = answers[item.id];
        return answer?.type === "short_answer" && answer.text.trim().length > 0;
      });
      for (let offset = 0; offset < essays.length; offset += 5) {
        const batch = essays.slice(offset, offset + 5);
        const grading = await this.ai.generateObject({
          schema: gradingSchema,
          schemaName: "practice_essay_grading",
          operation: "practice_evaluation",
          prompt: `Nilai setiap jawaban berdasarkan rubrik. Skor tiap kriteria 0 sampai 1. Jangan gunakan nilai di luar rubrik. Kembalikan tepat satu hasil untuk setiap itemId. Data:\n${JSON.stringify(batch.map((item) => ({ itemId: item.id, question: practiceItemContentSchema.parse(item.content), rubric: practiceItemKeySchema.parse(item.private_key), answer: answers[item.id] })))}`,
        });
        if (
          grading.answers.length !== batch.length ||
          new Set(grading.answers.map((grade) => grade.itemId)).size !== batch.length
        )
          throw new Error("Invalid grading output count");
        for (const item of batch) {
          const grade = grading.answers.find((entry) => entry.itemId === item.id);
          const key = practiceItemKeySchema.parse(item.private_key);
          if (
            !grade ||
            key.type !== "short_answer" ||
            grade.rubricScores.length !== key.rubric.length
          )
            throw new Error("Invalid grading rubric coverage");
          if (
            new Set(grade.rubricScores.map((part) => part.rubricIndex)).size !==
              key.rubric.length ||
            grade.rubricScores.some((part) => part.rubricIndex >= key.rubric.length)
          )
            throw new Error("Invalid grading rubric index");
          const result = results.find((entry) => entry.itemId === item.id);
          if (!result) throw new Error("Missing result");
          result.score = grade.rubricScores.reduce(
            (sum, part) => sum + key.rubric[part.rubricIndex].weight * part.score,
            0,
          );
          result.explanation = grade.explanation;
        }
      }
      const score = Math.round(
        (results.reduce((sum, result) => sum + result.score, 0) / Math.max(1, items.length)) * 100,
      );
      await this.db.transaction(async (tx) => {
        const [locked] = await tx
          .select()
          .from(practice_attempts)
          .where(eq(practice_attempts.id, attemptId))
          .for("update");
        if (!locked || locked.evaluated_at || locked.status !== "evaluating") return;
        await tx
          .update(practice_attempts)
          .set({
            status: "completed",
            results,
            score: String(score),
            evaluated_at: new Date(),
            failure: null,
          })
          .where(eq(practice_attempts.id, attemptId));
        if (
          set.kind === "flashcard" ||
          Object.values(answers).some(
            (answer) =>
              answer.type !== "flashcard" && (answer.type !== "short_answer" || answer.text.trim()),
          )
        )
          await awardPracticeCompletion(tx, {
            userId: attempt.user_id,
            practiceId: set.id,
            attemptId,
            kind: set.kind,
            moduleId: set.module_id,
          });
      });
    } catch (error) {
      if (job.attemptsMade + 1 >= 3)
        await this.db
          .update(practice_attempts)
          .set({
            status: "evaluation_failed",
            failure: { message: "Penilaian belum berhasil. Coba lagi." },
          })
          .where(
            and(eq(practice_attempts.id, attemptId), eq(practice_attempts.status, "evaluating")),
          );
      throw error;
    }
  }
}
