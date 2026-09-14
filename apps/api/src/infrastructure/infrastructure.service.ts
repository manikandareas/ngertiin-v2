import { Inject, Injectable, type OnApplicationShutdown } from "@nestjs/common";
import type { ApiEnvironment } from "@ngertiin/contracts/environment";
import { DatabaseClient } from "@ngertiin/database";
import { S3StorageService } from "@ngertiin/storage";
import { Redis } from "ioredis";
import { API_ENV } from "../config.js";

@Injectable()
export class InfrastructureService implements OnApplicationShutdown {
  draining = false;
  readonly database: DatabaseClient;
  readonly storage: S3StorageService;
  private redis?: Redis;
  private connectingRedis?: Promise<Redis>;

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
    const redis = await this.connectedRedis();
    await redis.ping();
  }

  async consumeRateLimit(
    userId: string,
    category: "read" | "mutation" | "expensive" | "stream" | "chatUpload" | "chatCancel",
  ): Promise<{ allowed: boolean; retryAfterSeconds: number; unavailable?: boolean }> {
    try {
      const redis = await this.connectedRedis();
      const windowSeconds =
        category === "chatUpload" || category === "chatCancel"
          ? 60
          : this.environment.RATE_LIMIT_WINDOW_SECONDS;
      const windowMilliseconds = windowSeconds * 1_000;
      const window = Math.floor(Date.now() / windowMilliseconds);
      const limit = {
        read: this.environment.RATE_LIMIT_READ_MAX,
        mutation: this.environment.RATE_LIMIT_MUTATION_MAX,
        expensive: this.environment.RATE_LIMIT_EXPENSIVE_MAX,
        stream: this.environment.RATE_LIMIT_STREAM_MAX,
        chatUpload: this.environment.CHAT_UPLOAD_RATE_LIMIT_PER_MINUTE,
        chatCancel: this.environment.CHAT_CANCEL_RATE_LIMIT_PER_MINUTE,
      }[category];
      const result = await redis.eval(
        "local count = redis.call('INCR', KEYS[1]); if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end; return count",
        1,
        `rate-limit:${category}:${userId}:${window}`,
        windowSeconds + 1,
      );
      const count = typeof result === "number" ? result : Number(result);
      if (!Number.isFinite(count)) throw new Error("Redis returned an invalid rate-limit count");
      return {
        allowed: count <= limit,
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((windowMilliseconds - (Date.now() % windowMilliseconds)) / 1_000),
        ),
      };
    } catch (error) {
      console.warn(
        JSON.stringify({
          level: "warn",
          event:
            category === "chatUpload" ? "api.rate_limit_unavailable" : "api.rate_limit_fail_open",
          category,
          errorType: error instanceof Error ? error.name : "UnknownError",
        }),
      );
      return {
        allowed: category !== "chatUpload",
        retryAfterSeconds: 0,
        ...(category === "chatUpload" ? { unavailable: true } : {}),
      };
    }
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

  private async connectedRedis(): Promise<Redis> {
    if (this.connectingRedis) return this.connectingRedis;
    const redis = this.ensureRedis();
    if (redis.status === "ready") return redis;
    this.connectingRedis = redis
      .connect()
      .then(() => redis)
      .finally(() => {
        this.connectingRedis = undefined;
      });
    return this.connectingRedis;
  }

  private ensureRedis(): Redis {
    if (this.redis && this.redis.status !== "end") return this.redis;
    this.redis = new Redis(this.environment.REDIS_URL, {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      connectTimeout: 1000,
      commandTimeout: 1000,
      retryStrategy: () => null,
    });
    this.redis.on("error", () => undefined);
    return this.redis;
  }
}
