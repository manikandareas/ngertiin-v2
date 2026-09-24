import {
  Inject,
  Injectable,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from "@nestjs/common";
import type { WorkerEnvironment } from "@ngertiin/contracts/environment";
import { type SpeechGenerationJob, speechGenerationJobSchema } from "@ngertiin/contracts/jobs";
import { speech_assets } from "@ngertiin/database";
import { QUEUE_NAMES } from "@ngertiin/shared";
import { Worker as BullWorker, type Job } from "bullmq";
import { eq } from "drizzle-orm";
import { WORKER_ENV } from "../config.js";
import { InfrastructureService } from "../infrastructure/infrastructure.service.js";
import { assembleSpeech } from "./assemble-speech.js";
import { synthesizeFishAudio } from "./speech-provider.js";

@Injectable()
export class SpeechProcessor implements OnApplicationBootstrap, OnApplicationShutdown {
  private worker?: BullWorker<SpeechGenerationJob>;

  constructor(
    @Inject(InfrastructureService) private readonly infrastructure: InfrastructureService,
    @Inject(WORKER_ENV) private readonly environment: WorkerEnvironment,
  ) {}

  onApplicationBootstrap(): void {
    this.worker = new BullWorker<SpeechGenerationJob>(
      QUEUE_NAMES.speechGeneration,
      (job) => this.process(job),
      {
        connection: this.infrastructure.redis,
        concurrency: 2,
      },
    );
    this.worker.on("error", (error) =>
      console.warn(JSON.stringify({ event: "speech.worker_error", errorType: error.name })),
    );
  }

  async onApplicationShutdown(): Promise<void> {
    await this.worker?.close();
  }

  private async process(job: Job<SpeechGenerationJob>): Promise<void> {
    const { assetId } = speechGenerationJobSchema.parse(job.data);
    const db = this.infrastructure.database.db;
    const [asset] = await db
      .select()
      .from(speech_assets)
      .where(eq(speech_assets.id, assetId))
      .limit(1);
    if (!asset || asset.status === "ready") return;
    await db
      .update(speech_assets)
      .set({ status: "processing", updated_at: new Date() })
      .where(eq(speech_assets.id, assetId));
    try {
      if (!this.environment.FISH_API_KEY) throw new Error("fish_audio_not_configured");
      if (!asset.blocks?.length) throw new Error("speech_blocks_missing");
      const apiKey = this.environment.FISH_API_KEY;
      const blocks = asset.blocks;
      const segments = new Array<Uint8Array>(blocks.length);
      let next = 0;
      let generationError: unknown;
      const workers = Array.from({ length: Math.min(3, blocks.length) }, async () => {
        while (next < blocks.length && !generationError) {
          const index = next++;
          try {
            segments[index] = await synthesizeFishAudio(apiKey, {
              text: blocks[index].text,
              model: asset.model,
              voice: asset.voice,
            });
          } catch (error) {
            generationError = error;
          }
        }
      });
      await Promise.all(workers);
      if (generationError) throw generationError;
      const { bytes, timeline } = await assembleSpeech(blocks, segments);
      const objectKey = `speech/fish-audio/${asset.fingerprint}.mp3`;
      await this.infrastructure.storage.put({
        key: objectKey,
        body: bytes,
        contentType: "audio/mpeg",
      });
      await db
        .update(speech_assets)
        .set({
          status: "ready",
          object_key: objectKey,
          timeline,
          failure_reason: null,
          updated_at: new Date(),
        })
        .where(eq(speech_assets.id, assetId));
      console.log(JSON.stringify({ event: "speech.ready", assetId, bytes: bytes.length }));
    } catch (error) {
      const reason = error instanceof Error ? error.message : "unknown_error";
      await db
        .update(speech_assets)
        .set({ status: "failed", failure_reason: reason.slice(0, 100), updated_at: new Date() })
        .where(eq(speech_assets.id, assetId));
      console.warn(JSON.stringify({ event: "speech.failed", assetId, reason }));
      throw error;
    }
  }
}
