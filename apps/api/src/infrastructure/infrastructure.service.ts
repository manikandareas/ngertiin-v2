import { Inject, Injectable, type OnApplicationShutdown } from "@nestjs/common";
import type { ApiEnvironment } from "@ngertiin/contracts/environment";
import { DatabaseClient } from "@ngertiin/database";
import { S3StorageService } from "@ngertiin/storage";
import { Redis } from "ioredis";
import { API_ENV } from "../config.js";

@Injectable()
export class InfrastructureService implements OnApplicationShutdown {
  readonly database: DatabaseClient;
  readonly storage: S3StorageService;
  private redis?: Redis;

  constructor(@Inject(API_ENV) private readonly environment: ApiEnvironment) {
    this.database = new DatabaseClient(environment.DATABASE_URL);
    this.storage = new S3StorageService({
      endpoint: environment.S3_ENDPOINT,
      region: environment.S3_REGION,
      accessKey: environment.S3_ACCESS_KEY,
      secretKey: environment.S3_SECRET_KEY,
      bucket: environment.S3_BUCKET,
      forcePathStyle: environment.S3_FORCE_PATH_STYLE,
    });
  }

  async checkPostgres(): Promise<void> {
    await this.database.check();
  }

  async checkRedis(): Promise<void> {
    if (!this.redis || this.redis.status === "end") {
      this.redis = new Redis(this.environment.REDIS_URL, {
        lazyConnect: true,
        enableOfflineQueue: false,
        maxRetriesPerRequest: 1,
        retryStrategy: () => null,
      });
      this.redis.on("error", () => undefined);
    }
    if (this.redis.status === "wait") {
      await this.redis.connect();
    }
    await this.redis.ping();
  }

  async checkStorage(): Promise<void> {
    await this.storage.check();
  }

  async onApplicationShutdown(): Promise<void> {
    await this.database.close();
    if (this.redis) {
      if (this.redis.status === "ready") {
        await this.redis.quit();
      } else {
        this.redis.disconnect();
      }
    }
    this.storage.close();
    console.log(JSON.stringify({ level: "log", event: "api.shutdown_complete" }));
  }
}
