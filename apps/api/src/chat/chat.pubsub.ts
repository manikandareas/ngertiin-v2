import {
  chatCitationSchema,
  chatImageSchema,
  chatRunDataSchema,
  chatRunStatusSchema,
} from "@ngertiin/contracts/api";
import type { UIMessageChunk } from "ai";
import { Redis } from "ioredis";
import { z } from "zod";

const metadataSchema = z.object({ runId: z.uuid(), status: chatRunStatusSchema });
const frameSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("start"),
    messageId: z.string(),
    messageMetadata: metadataSchema.optional(),
  }),
  z.object({ type: z.literal("text-start"), id: z.string() }),
  z.object({ type: z.literal("text-delta"), id: z.string(), delta: z.string() }),
  z.object({ type: z.literal("text-end"), id: z.string() }),
  z.object({ type: z.literal("data-run-status"), data: chatRunDataSchema }),
  z.object({
    type: z.literal("source-document"),
    sourceId: z.uuid(),
    mediaType: z.literal("text/plain"),
    title: z.string(),
  }),
  z.object({ type: z.literal("data-citation"), id: z.uuid(), data: chatCitationSchema }),
  z.object({ type: z.literal("data-image"), id: z.uuid(), data: chatImageSchema }),
  z.object({ type: z.literal("error"), errorText: z.string().max(200) }),
  z.object({ type: z.literal("finish"), messageMetadata: metadataSchema.optional() }),
]);
const eventSchema = z.object({
  runId: z.uuid(),
  sequence: z.number().int().nonnegative(),
  frames: z.array(frameSchema),
});
export type ChatStreamEvent = z.infer<typeof eventSchema>;
export type ChatSubscription = (
  receive: (event: ChatStreamEvent) => void,
  lost: () => void,
) => Promise<() => void>;

/** Ephemeral delivery only. PostgreSQL remains the queue and snapshot authority. */
export class ChatPubSub {
  private publisher?: Redis;
  private connecting?: Promise<Redis>;
  private readonly subscribers = new Set<Redis>();
  constructor(private readonly url: string) {}

  private connection(): Redis {
    const redis = new Redis(this.url, {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 0,
      retryStrategy: () => null,
      connectTimeout: 1000,
      commandTimeout: 1000,
    });
    redis.on("error", () => undefined);
    return redis;
  }
  private async client(): Promise<Redis> {
    if (this.publisher?.status === "ready") return this.publisher;
    if (this.connecting) return this.connecting;
    const redis = this.connection();
    this.publisher = redis;
    this.connecting = redis
      .connect()
      .then(() => redis)
      .finally(() => {
        this.connecting = undefined;
      });
    return this.connecting;
  }
  async publish(runId: string, sequence: number, frames: UIMessageChunk[]): Promise<void> {
    const event = eventSchema.parse({ runId, sequence, frames });
    await (await this.client()).publish(`chat:run:${runId}`, JSON.stringify(event));
  }
  async subscribe(
    runId: string,
    receive: (event: ChatStreamEvent) => void,
    lost: () => void,
  ): Promise<() => void> {
    const redis = this.connection();
    this.subscribers.add(redis);
    const close = () => {
      this.subscribers.delete(redis);
      redis.disconnect();
    };
    redis.on("close", lost);
    redis.on("message", (_channel, raw) => {
      try {
        const event = eventSchema.parse(JSON.parse(raw));
        if (event.runId !== runId) throw new Error("Invalid channel");
        receive(event);
      } catch {
        lost();
      }
    });
    try {
      await redis.connect();
      await redis.subscribe(`chat:run:${runId}`);
      return close;
    } catch (error) {
      close();
      throw error;
    }
  }
  async reserve(userId: string, member: string, limit: number): Promise<number> {
    // Redis TIME avoids host clock skew; only accepted reservations enter the window.
    const result = await (await this.client()).eval(
      `
      local t = redis.call('TIME')
      local now = t[1] * 1000 + math.floor(t[2] / 1000)
      redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', now - 60000)
      if redis.call('ZCARD', KEYS[1]) >= tonumber(ARGV[1]) then
        local first = redis.call('ZRANGE', KEYS[1], 0, 0, 'WITHSCORES')
        return math.max(1, math.ceil((tonumber(first[2]) + 60000 - now) / 1000))
      end
      redis.call('ZADD', KEYS[1], now, ARGV[2])
      redis.call('PEXPIRE', KEYS[1], 60000)
      return 0
    `,
      1,
      `chat:rate:${userId}`,
      limit,
      member,
    );
    return z.number().int().nonnegative().parse(result);
  }
  async release(userId: string, member: string): Promise<void> {
    await (await this.client()).zrem(`chat:rate:${userId}`, member);
  }
  close(): void {
    for (const redis of this.subscribers) redis.disconnect();
    this.subscribers.clear();
    this.publisher?.disconnect();
  }
}
