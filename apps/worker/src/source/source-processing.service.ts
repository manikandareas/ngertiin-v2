import {
  Inject,
  Injectable,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from "@nestjs/common";
import type { SourceFailure } from "@ngertiin/contracts/api";
import type { SourceProcessingJob } from "@ngertiin/contracts/jobs";
import { source_contents, source_processing_runs, sources } from "@ngertiin/database";
import { and, asc, eq, gt, inArray, sql } from "drizzle-orm";
import { InfrastructureService } from "../infrastructure/infrastructure.service.js";
import { SourceProcessingFailure } from "./source-processing.failure.js";

const DISPATCH_INTERVAL_MILLISECONDS = 2_000;

export interface PendingSourceProcessing {
  readonly type: "pdf" | "url";
  readonly storageKey: string | null;
  readonly originalUrl: string | null;
}

export interface NormalizedSourceContent {
  readonly type: "page" | "content";
  readonly position: number;
  readonly pageNumber: number | null;
  readonly content: string;
}

type QueuedRun = {
  readonly processingRunId: string;
  readonly sourceId: string;
};

@Injectable()
export class SourceProcessingService implements OnApplicationBootstrap, OnApplicationShutdown {
  private timer?: ReturnType<typeof setInterval>;
  private polling = false;
  private dispatchCursor?: string;

  constructor(
    @Inject(InfrastructureService) private readonly infrastructure: InfrastructureService,
  ) {}

  onApplicationBootstrap(): void {
    void this.pollQueuedRuns();
    this.timer = setInterval(() => void this.pollQueuedRuns(), DISPATCH_INTERVAL_MILLISECONDS);
    this.timer.unref();
  }

  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async withRunLock<Result>(runId: string, operation: () => Promise<Result>): Promise<Result> {
    const connection = await this.infrastructure.database.connection.reserve();
    const lockKey = `source-processing:${runId}`;
    try {
      await connection`select pg_advisory_lock(hashtextextended(${lockKey}, 0))`;
      try {
        return await operation();
      } finally {
        await connection`select pg_advisory_unlock(hashtextextended(${lockKey}, 0))`;
      }
    } finally {
      connection.release();
    }
  }

  async startRun(payload: SourceProcessingJob): Promise<PendingSourceProcessing | null> {
    return this.infrastructure.database.db.transaction(async (transaction) => {
      const [run] = await transaction
        .select({
          sourceId: source_processing_runs.source_id,
          status: source_processing_runs.status,
        })
        .from(source_processing_runs)
        .where(eq(source_processing_runs.id, payload.processingRunId))
        .for("update")
        .limit(1);
      if (!run || run.sourceId !== payload.sourceId) {
        throw new SourceProcessingFailure("SOURCE_PROCESSING_FAILED", false);
      }
      if (run.status === "completed" || run.status === "failed") return null;

      const [source] = await transaction
        .select({
          type: sources.type,
          storageKey: sources.storage_key,
          originalUrl: sources.original_url,
        })
        .from(sources)
        .where(eq(sources.id, payload.sourceId))
        .for("update")
        .limit(1);
      if (!source || source.type === "text") {
        throw new SourceProcessingFailure("SOURCE_PROCESSING_FAILED", false);
      }

      const now = new Date();
      await transaction
        .update(source_processing_runs)
        .set({
          status: "processing",
          error: null,
          started_at: sql`COALESCE(${source_processing_runs.started_at}, NOW())`,
        })
        .where(eq(source_processing_runs.id, payload.processingRunId));
      await transaction
        .update(sources)
        .set({ status: "processing", failure: null, updated_at: now })
        .where(eq(sources.id, payload.sourceId));

      return {
        type: source.type === "pdf" ? "pdf" : "url",
        storageKey: source.storageKey,
        originalUrl: source.originalUrl,
      };
    });
  }

  async completeRun(
    payload: SourceProcessingJob,
    contents: NormalizedSourceContent[],
    metadata: Record<string, unknown>,
  ): Promise<void> {
    await this.infrastructure.database.db.transaction(async (transaction) => {
      const [run] = await transaction
        .select({
          sourceId: source_processing_runs.source_id,
          status: source_processing_runs.status,
        })
        .from(source_processing_runs)
        .where(eq(source_processing_runs.id, payload.processingRunId))
        .for("update")
        .limit(1);
      if (!run || run.sourceId !== payload.sourceId) {
        throw new SourceProcessingFailure("SOURCE_PROCESSING_FAILED", false);
      }
      if (run.status === "completed") return;
      if (run.status !== "processing") {
        throw new SourceProcessingFailure("SOURCE_PROCESSING_FAILED", false);
      }

      const now = new Date();
      await transaction
        .delete(source_contents)
        .where(eq(source_contents.source_id, payload.sourceId));
      await transaction.insert(source_contents).values(
        contents.map((content) => ({
          source_id: payload.sourceId,
          type: content.type,
          position: content.position,
          page_number: content.pageNumber,
          content: content.content,
          created_at: now,
        })),
      );
      await transaction
        .update(sources)
        .set({
          status: "ready",
          failure: null,
          metadata: sql`COALESCE(${sources.metadata}, '{}'::jsonb) || ${JSON.stringify(metadata)}::jsonb`,
          updated_at: now,
        })
        .where(eq(sources.id, payload.sourceId));
      await transaction
        .update(source_processing_runs)
        .set({ status: "completed", error: null, metadata, finished_at: now })
        .where(eq(source_processing_runs.id, payload.processingRunId));
    });
  }

  async failRun(payload: SourceProcessingJob, failure: SourceFailure): Promise<void> {
    await this.infrastructure.database.db.transaction(async (transaction) => {
      const [run] = await transaction
        .select({
          sourceId: source_processing_runs.source_id,
          status: source_processing_runs.status,
        })
        .from(source_processing_runs)
        .where(eq(source_processing_runs.id, payload.processingRunId))
        .for("update")
        .limit(1);
      if (!run || run.sourceId !== payload.sourceId || run.status === "completed") return;

      const now = new Date();
      await transaction
        .update(sources)
        .set({ status: "failed", failure, updated_at: now })
        .where(eq(sources.id, payload.sourceId));
      await transaction
        .update(source_processing_runs)
        .set({ status: "failed", error: failure, finished_at: now })
        .where(eq(source_processing_runs.id, payload.processingRunId));
    });
  }

  private async pollQueuedRuns(): Promise<void> {
    if (this.polling) return;
    this.polling = true;
    try {
      const runs = await this.infrastructure.database.db
        .select({
          processingRunId: source_processing_runs.id,
          sourceId: source_processing_runs.source_id,
        })
        .from(source_processing_runs)
        .where(
          and(
            inArray(source_processing_runs.status, ["queued", "processing"]),
            this.dispatchCursor ? gt(source_processing_runs.id, this.dispatchCursor) : undefined,
          ),
        )
        .orderBy(asc(source_processing_runs.id))
        .limit(25);

      for (const run of runs) await this.dispatchRun(run);
      this.dispatchCursor = runs.length === 25 ? runs.at(-1)?.processingRunId : undefined;
    } catch (error) {
      console.error(
        JSON.stringify({
          level: "error",
          event: "source_processing.dispatch_poll_failed",
          errorType: error instanceof Error ? error.name : "UnknownError",
        }),
      );
    } finally {
      this.polling = false;
    }
  }

  private async dispatchRun(run: QueuedRun): Promise<void> {
    const payload: SourceProcessingJob = run;
    try {
      const outcome = await this.infrastructure.ensureJob({
        queue: this.infrastructure.sourceProcessingQueue,
        name: "process-source",
        data: payload,
        jobId: run.processingRunId,
        options: { attempts: 3, backoff: { type: "exponential", delay: 5_000 } },
      });
      await this.infrastructure.database.db
        .update(source_processing_runs)
        .set({ bullmq_job_id: run.processingRunId })
        .where(eq(source_processing_runs.id, run.processingRunId));
      console.log(
        JSON.stringify({
          level: "log",
          event: "source_processing.dispatched",
          runId: run.processingRunId,
          sourceId: run.sourceId,
          outcome,
        }),
      );
    } catch (error) {
      console.error(
        JSON.stringify({
          level: "error",
          event: "source_processing.dispatch_failed",
          runId: run.processingRunId,
          errorType: error instanceof Error ? error.name : "UnknownError",
        }),
      );
    }
  }
}
