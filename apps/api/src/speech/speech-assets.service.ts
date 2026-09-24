import { Inject, Injectable, type OnApplicationShutdown } from "@nestjs/common";
import type { SpeechAsset } from "@ngertiin/contracts/api";
import type { ApiEnvironment } from "@ngertiin/contracts/environment";
import { speech_assets } from "@ngertiin/database";
import { type LessonSpeechBlock, QUEUE_NAMES, speechFingerprint } from "@ngertiin/shared";
import { Queue } from "bullmq";
import { and, eq } from "drizzle-orm";
import { Redis } from "ioredis";
import { API_ENV } from "../config.js";
import { ProductError } from "../http/product-error.js";
import { InfrastructureService } from "../infrastructure/infrastructure.service.js";

@Injectable()
export class SpeechAssetsService implements OnApplicationShutdown {
  private readonly redis: Redis;
  private readonly queue: Queue;

  constructor(
    @Inject(InfrastructureService) private readonly infrastructure: InfrastructureService,
    @Inject(API_ENV) private readonly environment: ApiEnvironment,
  ) {
    this.redis = new Redis(environment.REDIS_URL, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });
    this.redis.on("error", () => undefined);
    this.queue = new Queue(QUEUE_NAMES.speechGeneration, { connection: this.redis });
    this.queue.on("error", () => undefined);
  }

  async onApplicationShutdown(): Promise<void> {
    await this.queue.close();
    if (this.redis.status === "ready") await this.redis.quit();
    else this.redis.disconnect();
  }

  async get(blocks: LessonSpeechBlock[], create: boolean): Promise<SpeechAsset> {
    if (!blocks.length)
      throw new ProductError(422, "VALIDATION_ERROR", "Empty text", "There is no text to narrate.");
    const voice = this.environment.FISH_TTS_REFERENCE_ID;
    if (!voice)
      throw new ProductError(
        503,
        "DEPENDENCY_UNAVAILABLE",
        "Speech unavailable",
        "Speech is not configured.",
      );
    const model = this.environment.FISH_TTS_MODEL;
    const fingerprint = speechFingerprint(blocks, "fish-audio", model, voice);
    const db = this.infrastructure.database.db;
    if (create) {
      await db
        .insert(speech_assets)
        .values({
          fingerprint,
          text: blocks.map((block) => block.text).join(" "),
          blocks,
          provider: "fish-audio",
          model,
          voice,
        })
        .onConflictDoNothing();
    }
    const [asset] = await db
      .select()
      .from(speech_assets)
      .where(eq(speech_assets.fingerprint, fingerprint))
      .limit(1);
    if (!asset)
      throw new ProductError(404, "NOT_FOUND", "Audio not found", "Audio has not been requested.");

    const retry = create && asset.status === "failed";
    if (retry) {
      await db
        .update(speech_assets)
        .set({ status: "queued", failure_reason: null, updated_at: new Date() })
        .where(eq(speech_assets.id, asset.id));
    }
    if (create && (asset.status === "queued" || retry)) {
      try {
        const existing = await this.queue.getJob(asset.id);
        if (existing && ["completed", "failed"].includes(await existing.getState()))
          await existing.remove();
        await this.queue.add(
          "synthesize",
          { assetId: asset.id },
          {
            jobId: asset.id,
            removeOnComplete: true,
            removeOnFail: true,
          },
        );
      } catch {
        await db
          .update(speech_assets)
          .set({ status: "failed", failure_reason: "queue_unavailable", updated_at: new Date() })
          .where(and(eq(speech_assets.id, asset.id), eq(speech_assets.status, "queued")));
        throw new ProductError(
          503,
          "DEPENDENCY_UNAVAILABLE",
          "Speech unavailable",
          "Speech could not be queued.",
        );
      }
    }
    if (asset.status === "ready" && asset.object_key && asset.timeline) {
      return {
        status: "ready",
        url: await this.infrastructure.storage.createSignedUrl(asset.object_key),
        timeline: asset.timeline,
      };
    }
    return {
      status: retry ? "queued" : (asset.status as SpeechAsset["status"]),
      url: null,
      timeline: null,
    };
  }
}
