import { createHash, randomUUID } from "node:crypto";
import { Mistral } from "@mistralai/mistralai";
import {
  Inject,
  Injectable,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from "@nestjs/common";
import {
  CHAT_ATTACHMENT_TOTAL_BYTES,
  type ChatAttachment,
  chatPartSchema,
  type SendChatMessage,
} from "@ngertiin/contracts/api";
import type { ApiEnvironment } from "@ngertiin/contracts/environment";
import {
  chat_attachments,
  chat_messages,
  chat_runs,
  chat_threads,
  type DatabaseTransaction,
} from "@ngertiin/database";
import { processOcr } from "@ngertiin/shared/ocr";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { API_ENV } from "../config.js";
import { ProductError } from "../http/product-error.js";
import { InfrastructureService } from "../infrastructure/infrastructure.service.js";
import { LearningRunError } from "./chat.errors.js";
import {
  type AttachmentUpload,
  invalidAttachment,
  readUtf8,
  validateAttachment,
} from "./chat-attachment-validation.js";

const DRAFT_LIFETIME_MS = 24 * 60 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 60_000;
const CLEANUP_BATCH_SIZE = 50;
const OBJECT_DELETE_TIMEOUT_MS = 5_000;
const DOWNLOAD_URL_TTL_SECONDS = 60;
const MAX_EXTRACTION_CHARACTERS = 200_000;

export type AttachmentRow = typeof chat_attachments.$inferSelect;
export function attachmentDto(row: AttachmentRow): ChatAttachment {
  return { id: row.id, filename: row.filename, mimeType: row.mime_type, size: row.size };
}
@Injectable()
export class ChatAttachmentsService implements OnApplicationBootstrap, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private cleaning?: Promise<void>;
  private readonly shutdown = new AbortController();
  onApplicationBootstrap() {
    const collect = () => {
      if (this.cleaning || this.shutdown.signal.aborted) return;
      this.cleaning = this.cleanup()
        .catch(() => console.warn(JSON.stringify({ event: "chat.attachment_cleanup_failed" })))
        .finally(() => {
          this.cleaning = undefined;
        });
    };
    collect();
    this.timer = setInterval(collect, CLEANUP_INTERVAL_MS);
    this.timer.unref();
  }
  async onModuleDestroy() {
    clearInterval(this.timer);
    this.shutdown.abort();
    await this.cleaning;
  }

  private get db() {
    return this.infrastructure.database.db;
  }
  constructor(
    @Inject(InfrastructureService) private readonly infrastructure: InfrastructureService,
    @Inject(API_ENV) private readonly env: ApiEnvironment,
  ) {}
  async admit(tx: DatabaseTransaction, userId: string, threadId: string, input: SendChatMessage) {
    const ids = input.attachmentIds ?? [];
    if (!ids.length) return [];
    const rows = await tx
      .select()
      .from(chat_attachments)
      .where(
        and(
          inArray(chat_attachments.id, ids),
          eq(chat_attachments.user_id, userId),
          isNull(chat_attachments.deleted_at),
        ),
      )
      .orderBy(asc(chat_attachments.id))
      .for("update");
    if (rows.length !== ids.length) invalidAttachment("Lampiran tidak ditemukan.");
    const [retry] = input.retryOfRunId
      ? await tx
          .select()
          .from(chat_messages)
          .where(
            and(
              eq(chat_messages.thread_id, threadId),
              eq(chat_messages.run_id, input.retryOfRunId),
              eq(chat_messages.role, "user"),
            ),
          )
      : [];
    const retryIds = retry
      ? chatPartSchema
          .array()
          .parse(retry.parts_json)
          .flatMap((p) => (p.type === "data-attachment" ? [p.id] : []))
      : [];
    for (const row of rows) {
      if (row.thread_id) {
        if (row.thread_id !== threadId || !retryIds.includes(row.id))
          invalidAttachment("Lampiran sudah digunakan pada pesan lain.");
      } else if (row.created_at.getTime() <= Date.now() - DRAFT_LIFETIME_MS)
        invalidAttachment("Lampiran draft kedaluwarsa. Unggah ulang.");
    }
    if (rows.reduce((sum, row) => sum + row.size, 0) > CHAT_ATTACHMENT_TOTAL_BYTES)
      invalidAttachment("Total lampiran maksimal 25 MB.");
    return rows;
  }
  async upload(userId: string, file?: AttachmentUpload) {
    if (!file) invalidAttachment("Pilih file untuk diunggah.");
    const validated = await validateAttachment(file);
    const id = randomUUID();
    const key = `chat/${userId}/${id}`;
    // A durable draft exists before the object write; failed writes are collected too.
    const [row] = await this.db
      .insert(chat_attachments)
      .values({
        id,
        user_id: userId,
        object_key: key,
        filename: validated.filename,
        mime_type: validated.mime,
        size: file.buffer.length,
        // Legacy column retained for database compatibility; provider budgets native files.
        context_tokens: 0,
        content_hash: createHash("sha256").update(file.buffer).digest("hex"),
      })
      .returning();
    if (!row) throw new Error("Missing attachment");
    try {
      await this.infrastructure.storage.put({
        key,
        body: file.buffer,
        contentType: validated.mime,
      });
    } catch (error) {
      await this.db
        .update(chat_attachments)
        .set({ deleted_at: new Date() })
        .where(eq(chat_attachments.id, id));
      throw error;
    }
    return attachmentDto(row);
  }
  async owned(userId: string, id: string) {
    const [row] = await this.db
      .select()
      .from(chat_attachments)
      .where(
        and(
          eq(chat_attachments.id, id),
          eq(chat_attachments.user_id, userId),
          isNull(chat_attachments.deleted_at),
          sql`(${chat_attachments.thread_id} is not null or ${chat_attachments.created_at} > now() - interval '24 hours')`,
        ),
      );
    if (row?.thread_id) {
      const [thread] = await this.db
        .select({ id: chat_threads.id })
        .from(chat_threads)
        .where(and(eq(chat_threads.id, row.thread_id), isNull(chat_threads.deleted_at)));
      if (!thread) this.notFound();
    }
    if (!row) this.notFound();
    return row;
  }
  private notFound(): never {
    throw new ProductError(404, "NOT_FOUND", "Attachment not found", "Lampiran tidak ditemukan.");
  }
  async download(userId: string, id: string) {
    const row = await this.owned(userId, id);
    return {
      url: await this.infrastructure.storage.createSignedUrl(
        row.object_key,
        DOWNLOAD_URL_TTL_SECONDS,
      ),
    };
  }
  async remove(userId: string, id: string) {
    await this.owned(userId, id);
    const rows = await this.db
      .update(chat_attachments)
      .set({ deleted_at: new Date(), extraction_text: null, extraction_usage: null })
      .where(
        and(
          eq(chat_attachments.id, id),
          eq(chat_attachments.user_id, userId),
          isNull(chat_attachments.thread_id),
        ),
      )
      .returning({ id: chat_attachments.id });
    if (!rows.length)
      invalidAttachment("Lampiran yang sudah dikirim tidak dapat dihapus sebagai draft.");
  }
  async cleanup() {
    await this.db
      .update(chat_attachments)
      .set({ deleted_at: new Date(), extraction_text: null, extraction_usage: null })
      .where(
        and(
          isNull(chat_attachments.deleted_at),
          sql`(
      (${chat_attachments.thread_id} is null and ${chat_attachments.created_at} < now() - interval '24 hours') or
      exists (select 1 from chat_threads t where t.id = ${chat_attachments.thread_id} and t.deleted_at is not null)
    )`,
        ),
      );
    const rows = await this.db
      .select()
      .from(chat_attachments)
      .where(sql`${chat_attachments.deleted_at} is not null`)
      .limit(CLEANUP_BATCH_SIZE);
    for (const row of rows) {
      if (this.shutdown.signal.aborted) break;
      try {
        await this.infrastructure.storage.delete(
          row.object_key,
          AbortSignal.any([this.shutdown.signal, AbortSignal.timeout(OBJECT_DELETE_TIMEOUT_MS)]),
        );
        await this.db
          .delete(chat_attachments)
          .where(
            and(eq(chat_attachments.id, row.id), sql`${chat_attachments.deleted_at} is not null`),
          );
      } catch {
        console.warn(
          JSON.stringify({ event: "chat.attachment_cleanup_retry", attachmentId: row.id }),
        );
      }
    }
  }
  async modelFileSource(row: AttachmentRow, signal: AbortSignal) {
    signal.throwIfAborted();
    if (this.env.NODE_ENV === "development") {
      return {
        source_type: "base64" as const,
        data: Buffer.from(await this.bytes(row, signal)).toString("base64"),
      };
    }
    return {
      source_type: "url" as const,
      url: await this.infrastructure.storage.createSignedUrl(
        row.object_key,
        Math.ceil(this.env.CHAT_RUN_TIMEOUT_MS / 1000) + 60,
      ),
    };
  }
  async bytes(row: AttachmentRow, signal: AbortSignal) {
    signal.throwIfAborted();
    const bytes = await this.infrastructure.storage.get(row.object_key, signal);
    signal.throwIfAborted();
    if (
      bytes.length !== row.size ||
      createHash("sha256").update(bytes).digest("hex") !== row.content_hash
    )
      throw new LearningRunError("ATTACHMENT_UNREADABLE");
    return bytes;
  }
  async extract(row: AttachmentRow, run: typeof chat_runs.$inferSelect, signal: AbortSignal) {
    signal.throwIfAborted();
    if (row.extraction_status === "ready" && row.extraction_text !== null)
      return row.extraction_text;
    const bytes = await this.bytes(row, signal);
    let text: string;
    let usage: unknown = null;
    try {
      if (row.mime_type.startsWith("text/")) text = readUtf8(bytes);
      else {
        if (!/\.(pdf|jpe?g|png|webp|docx|pptx)$/i.test(row.filename) || !this.env.MISTRAL_API_KEY)
          throw new LearningRunError("ATTACHMENT_UNREADABLE");
        usage = {
          provider: "mistral",
          model: this.env.MISTRAL_OCR_MODEL,
          runId: run.id,
          coverage: "unavailable",
        };
        await this.saveExtraction(row.id, run, signal, {
          extraction_status: "pending",
          extraction_usage: usage,
        });
        console.log(
          JSON.stringify({
            event: "chat.ocr_started",
            attachmentId: row.id,
            runId: run.id,
            provider: "mistral",
            model: this.env.MISTRAL_OCR_MODEL,
          }),
        );
        const result = await processOcr(new Mistral({ apiKey: this.env.MISTRAL_API_KEY }), {
          model: this.env.MISTRAL_OCR_MODEL,
          binary: bytes,
          mimeType: row.mime_type,
          signal,
        });
        text = [...result.pages]
          .sort((a, b) => a.index - b.index)
          .map((page) => `## Halaman ${page.index + 1}\n${page.markdown}`)
          .join("\n\n");
        if (!text.trim()) throw new LearningRunError("ATTACHMENT_UNREADABLE");
        usage = {
          provider: "mistral",
          model: this.env.MISTRAL_OCR_MODEL,
          runId: run.id,
          coverage: "complete",
          ...result.usageInfo,
        };
      }
      signal.throwIfAborted();
      if (text.length > MAX_EXTRACTION_CHARACTERS) throw new LearningRunError("CONTEXT_LIMIT");
      await this.saveExtraction(row.id, run, signal, {
        extraction_status: "ready",
        extraction_text: text,
        extraction_usage: usage,
      });
      row.extraction_status = "ready";
      row.extraction_text = text;
      row.extraction_usage = usage;
      console.log(
        JSON.stringify({
          event: "chat.attachment_extracted",
          attachmentId: row.id,
          runId: run.id,
          usage,
        }),
      );
      return text;
    } catch (error) {
      signal.throwIfAborted();
      await this.saveExtraction(row.id, run, signal, {
        extraction_status: "failed",
        extraction_usage: usage,
      }).catch(() => undefined);
      console.warn(
        JSON.stringify({
          event: "chat.attachment_extraction_failed",
          attachmentId: row.id,
          runId: run.id,
          errorType: error instanceof Error ? error.name : "UnknownError",
        }),
      );
      throw error;
    }
  }
  private async saveExtraction(
    id: string,
    run: typeof chat_runs.$inferSelect,
    signal: AbortSignal,
    values: Pick<
      typeof chat_attachments.$inferInsert,
      "extraction_status" | "extraction_text" | "extraction_usage"
    >,
  ) {
    // The same lock and fence apply to success and failure. No late result may write after cancellation.
    await this.db.transaction(async (tx) => {
      const [active] = await tx
        .select({ id: chat_runs.id })
        .from(chat_runs)
        .where(
          and(
            eq(chat_runs.id, run.id),
            eq(chat_runs.executor_id, run.executor_id ?? ""),
            eq(chat_runs.lease_epoch, run.lease_epoch),
            eq(chat_runs.status, "running"),
            isNull(chat_runs.cancel_requested_at),
            sql`${chat_runs.lease_expires_at} > clock_timestamp() and ${chat_runs.deadline_at} > clock_timestamp()`,
          ),
        )
        .for("update");
      signal.throwIfAborted();
      if (!active) throw new LearningRunError("PROCESS_INTERRUPTED");
      await tx
        .update(chat_attachments)
        .set(values)
        .where(and(eq(chat_attachments.id, id), isNull(chat_attachments.deleted_at)));
    });
  }
}
