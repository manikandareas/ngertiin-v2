import { Inject, Injectable, type OnApplicationShutdown, type OnModuleInit } from "@nestjs/common";
import type { WorkerEnvironment } from "@ngertiin/contracts/environment";
import { DatabaseClient } from "@ngertiin/database";
import { QUEUE_NAMES } from "@ngertiin/shared";
import { S3StorageService } from "@ngertiin/storage";
import { type JobsOptions, Queue } from "bullmq";
import { Redis } from "ioredis";
import { WORKER_ENV } from "../config.js";

@Injectable()
export class InfrastructureService implements OnModuleInit, OnApplicationShutdown {
  readonly database: DatabaseClient;
  readonly storage: S3StorageService;
  readonly redis: Redis;
  readonly sourceProcessingQueue: Queue;
  readonly moduleGenerationQueue: Queue;
  readonly adaptiveGenerationQueue: Queue;
  readonly attemptEvaluationQueue: Queue;
  private queueSnapshotTimer?: ReturnType<typeof setInterval>;

  constructor(@Inject(WORKER_ENV) environment: WorkerEnvironment) {
    this.database = new DatabaseClient(environment.DATABASE_URL);
    this.storage = new S3StorageService({
      endpoint: environment.S3_ENDPOINT,
      region: environment.S3_REGION,
      accessKey: environment.S3_ACCESS_KEY,
      secretKey: environment.S3_SECRET_KEY,
      bucket: environment.S3_BUCKET,
      forcePathStyle: environment.S3_FORCE_PATH_STYLE,
    });
    this.redis = new Redis(environment.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: null,
      retryStrategy: (attempt) => Math.min(attempt * 200, 2_000),
    });
    this.redis.on("error", () => undefined);
    this.sourceProcessingQueue = new Queue(QUEUE_NAMES.sourceProcessing, {
      connection: this.redis,
    });
    this.sourceProcessingQueue.on("error", () => undefined);
    this.moduleGenerationQueue = new Queue(QUEUE_NAMES.moduleGeneration, {
      connection: this.redis,
    });
    this.moduleGenerationQueue.on("error", () => undefined);
    this.adaptiveGenerationQueue = new Queue(QUEUE_NAMES.adaptiveGeneration, {
      connection: this.redis,
    });
    this.adaptiveGenerationQueue.on("error", () => undefined);
    this.attemptEvaluationQueue = new Queue(QUEUE_NAMES.attemptEvaluation, {
      connection: this.redis,
    });
    this.attemptEvaluationQueue.on("error", () => undefined);
  }

  async onModuleInit(): Promise<void> {
    const startupTimeout = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Initial dependency check timed out")), 5_000).unref();
    });

    try {
      await Promise.race([
        Promise.all([
          this.database.check(),
          this.redis.ping(),
          this.storage.check(),
          this.sourceProcessingQueue.waitUntilReady(),
          this.moduleGenerationQueue.waitUntilReady(),
          this.adaptiveGenerationQueue.waitUntilReady(),
          this.attemptEvaluationQueue.waitUntilReady(),
        ]),
        startupTimeout,
      ]);
      void this.logQueueSnapshot();
      this.queueSnapshotTimer = setInterval(() => void this.logQueueSnapshot(), 60_000);
      this.queueSnapshotTimer.unref();
    } catch (error) {
      await this.close();
      throw error;
    }
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.queueSnapshotTimer) clearInterval(this.queueSnapshotTimer);
    await this.close();
    console.log(JSON.stringify({ level: "log", event: "worker.shutdown_complete" }));
  }

  async ensureJob(input: {
    queue: Queue;
    name: string;
    data: unknown;
    jobId: string;
    options: JobsOptions;
  }): Promise<"preserved" | "created" | "requeued"> {
    const existing = await input.queue.getJob(input.jobId);
    let requeued = false;
    if (existing) {
      const state = await existing.getState();
      if (state !== "completed" && state !== "failed") return "preserved";
      await existing.remove();
      requeued = true;
    }
    await input.queue.add(input.name, input.data, { ...input.options, jobId: input.jobId });
    return requeued ? "requeued" : "created";
  }

  private async logQueueSnapshot(): Promise<void> {
    try {
      const queues = [
        this.sourceProcessingQueue,
        this.moduleGenerationQueue,
        this.attemptEvaluationQueue,
        this.adaptiveGenerationQueue,
      ];
      const snapshots = await Promise.all(
        queues.map(async (queue) => ({
          queue: queue.name,
          ...(await queue.getJobCounts("waiting", "active", "delayed", "failed")),
        })),
      );
      for (const snapshot of snapshots) {
        console.log(JSON.stringify({ level: "log", event: "worker.queue_snapshot", ...snapshot }));
      }
    } catch (error) {
      console.warn(
        JSON.stringify({
          level: "warn",
          event: "worker.queue_snapshot_failed",
          errorType: error instanceof Error ? error.name : "UnknownError",
        }),
      );
    }
  }

  private async close(): Promise<void> {
    await this.sourceProcessingQueue.close();
    await this.moduleGenerationQueue.close();
    await this.adaptiveGenerationQueue.close();
    await this.attemptEvaluationQueue.close();
    await this.database.close();
    if (this.redis.status === "ready") {
      await this.redis.quit();
    } else {
      this.redis.disconnect();
    }
    this.storage.close();
  }
}
