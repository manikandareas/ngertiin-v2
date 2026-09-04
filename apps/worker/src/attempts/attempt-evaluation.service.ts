import {
  Inject,
  Injectable,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from "@nestjs/common";
import type { AttemptEvaluationJob } from "@ngertiin/contracts/jobs";
import { activities, attempt_responses, attempts } from "@ngertiin/database";
import { and, asc, eq } from "drizzle-orm";
import { InfrastructureService } from "../infrastructure/infrastructure.service.js";

const DISPATCH_INTERVAL_MILLISECONDS = 1_000;

@Injectable()
export class AttemptEvaluationService implements OnApplicationBootstrap, OnApplicationShutdown {
  private timer?: ReturnType<typeof setInterval>;
  private polling = false;

  constructor(
    @Inject(InfrastructureService) private readonly infrastructure: InfrastructureService,
  ) {}

  onApplicationBootstrap(): void {
    void this.pollEvaluatingAttempts();
    this.timer = setInterval(
      () => void this.pollEvaluatingAttempts(),
      DISPATCH_INTERVAL_MILLISECONDS,
    );
    this.timer.unref();
  }

  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async withAttemptLock(attemptId: string, run: () => Promise<void>): Promise<void> {
    const connection = await this.infrastructure.database.connection.reserve();
    try {
      await connection`select pg_advisory_lock(hashtextextended(${attemptId}, 0))`;
      await run();
    } finally {
      try {
        await connection`select pg_advisory_unlock(hashtextextended(${attemptId}, 0))`;
      } finally {
        connection.release();
      }
    }
  }

  private async pollEvaluatingAttempts(): Promise<void> {
    if (this.polling) return;
    this.polling = true;
    try {
      const rows = await this.infrastructure.database.db
        .selectDistinct({ attemptId: attempts.id, createdAt: attempts.created_at })
        .from(attempts)
        .innerJoin(attempt_responses, eq(attempt_responses.attempt_id, attempts.id))
        .innerJoin(activities, eq(activities.id, attempt_responses.activity_id))
        .where(
          and(eq(attempts.evaluation_status, "evaluating"), eq(activities.type, "short_answer")),
        )
        .orderBy(asc(attempts.created_at), asc(attempts.id))
        .limit(100);
      await Promise.all(rows.map(({ attemptId }) => this.dispatchAttempt(attemptId)));
    } catch (error) {
      console.error(
        JSON.stringify({
          level: "error",
          event: "attempt_evaluation.dispatch_failed",
          errorType: error instanceof Error ? error.name : "UnknownError",
        }),
      );
    } finally {
      this.polling = false;
    }
  }

  private async dispatchAttempt(attemptId: string): Promise<void> {
    const existing = await this.infrastructure.attemptEvaluationQueue.getJob(attemptId);
    if (existing) {
      const state = await existing.getState();
      if (state === "failed" || state === "completed") await existing.remove();
    }
    const payload: AttemptEvaluationJob = { attemptId };
    await this.infrastructure.attemptEvaluationQueue.add("evaluate-attempt", payload, {
      jobId: attemptId,
      attempts: 3,
      backoff: { type: "exponential", delay: 1_000 },
    });
  }
}
