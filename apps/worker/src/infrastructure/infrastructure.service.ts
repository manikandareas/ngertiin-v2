import { Inject, Injectable, type OnApplicationShutdown, type OnModuleInit } from "@nestjs/common";
import type { WorkerEnvironment } from "@ngertiin/contracts/environment";
import { DatabaseClient } from "@ngertiin/database";
import { QUEUE_NAMES } from "@ngertiin/shared";
import { S3StorageService } from "@ngertiin/storage";
import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { WORKER_ENV } from "../config.js";

@Injectable()
export class InfrastructureService implements OnModuleInit, OnApplicationShutdown {
  readonly database: DatabaseClient;
  readonly storage: S3StorageService;
  readonly redis: Redis;
  readonly moduleGenerationQueue: Queue;

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
    this.moduleGenerationQueue = new Queue(QUEUE_NAMES.moduleGeneration, {
      connection: this.redis,
    });
    this.moduleGenerationQueue.on("error", () => undefined);
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
          this.moduleGenerationQueue.waitUntilReady(),
        ]),
        startupTimeout,
      ]);
    } catch (error) {
      await this.close();
      throw error;
    }
  }

  async onApplicationShutdown(): Promise<void> {
    await this.close();
    console.log(JSON.stringify({ level: "log", event: "worker.shutdown_complete" }));
  }

  private async close(): Promise<void> {
    await this.moduleGenerationQueue.close();
    await this.database.close();
    if (this.redis.status === "ready") {
      await this.redis.quit();
    } else {
      this.redis.disconnect();
    }
    this.storage.close();
  }
}
