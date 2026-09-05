import {
  Inject,
  Injectable,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from "@nestjs/common";
import type { AttemptEvaluationJob } from "@ngertiin/contracts/jobs";
import { activities, attempt_responses, attempts } from "@ngertiin/database";
import { and, asc, eq, gt } from "drizzle-orm";
import { InfrastructureService } from "../infrastructure/infrastructure.service.js";

const DISPATCH_INTERVAL_MILLISECONDS = 1_000;

@Injectable()
export class AttemptEvaluationService implements OnApplicationBootstrap, OnApplicationShutdown {
  private timer?: ReturnType<typeof setInterval>;
  private polling = false;
  private dispatchCursor?: string;

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
        .selectDistinct({ attemptId: attempts.id })
        .from(attempts)
        .innerJoin(attempt_responses, eq(attempt_responses.attempt_id, attempts.id))
        .innerJoin(activities, eq(activities.id, attempt_responses.activity_id))
        .where(
          and(
            eq(attempts.evaluation_status, "evaluating"),
            eq(activities.type, "short_answer"),
            this.dispatchCursor ? gt(attempts.id, this.dispatchCursor) : undefined,
          ),
        )
        .orderBy(asc(attempts.id))
        .limit(100);
      await Promise.all(rows.map(({ attemptId }) => this.dispatchAttempt(attemptId)));
      this.dispatchCursor = rows.length === 100 ? rows.at(-1)?.attemptId : undefined;
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
    const payload: AttemptEvaluationJob = { attemptId };
    const outcome = await this.infrastructure.ensureJob({
      queue: this.infrastructure.attemptEvaluationQueue,
      name: "evaluate-attempt",
      data: payload,
      jobId: attemptId,
      options: { attempts: 3, backoff: { type: "exponential", delay: 1_000 } },
    });
    console.log(
      JSON.stringify({
        level: "log",
        event: "attempt_evaluation.dispatched",
        attemptId,
        outcome,
      }),
    );
  }
}
