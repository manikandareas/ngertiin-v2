import { createHash, randomUUID } from "node:crypto";
import { toUIMessageStream } from "@ai-sdk/langchain";
import { AIMessage, type BaseMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import {
  Inject,
  Injectable,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from "@nestjs/common";
import {
  activeChatStatuses,
  type ChatAcknowledgment,
  type ChatMessage,
  type ChatPagination,
  type ChatPart,
  type ChatRunError,
  type ChatRunStatus,
  type ChatUsage,
  chatMessageSchema,
  chatPartSchema,
  chatRunSchema,
  chatThreadSchema,
  isChatRunActive,
  type SendChatMessage,
} from "@ngertiin/contracts/api";
import type { ApiEnvironment } from "@ngertiin/contracts/environment";
import {
  chat_message_contexts,
  chat_messages,
  chat_run_usage,
  chat_runs,
  chat_threads,
} from "@ngertiin/database";
import { and, asc, desc, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { AiService } from "../ai/ai.service.js";
import { API_ENV } from "../config.js";
import { ProductError } from "../http/product-error.js";
import { IdempotencyService } from "../idempotency/idempotency.service.js";
import { InfrastructureService } from "../infrastructure/infrastructure.service.js";
import { ModulesService } from "../modules/modules.service.js";
import { chatPage, readChatCursor } from "./chat.pagination.js";
import { createLearningAgent } from "./learning.agent.js";
import { learningPrompt } from "./prompts/learning.prompt.js";

type RunRow = typeof chat_runs.$inferSelect;
const emptyUsage: ChatUsage = {
  inputTokens: null,
  outputTokens: null,
  totalTokens: null,
  coverage: "unavailable",
};
const textOf = (parts: unknown): string =>
  chatMessageParts(parts)
    .filter((p) => p.type === "text")
    .map((p) => p.text)
    .join("");
function chatMessageParts(parts: unknown): ChatPart[] {
  return chatPartSchema.array().parse(parts);
}

@Injectable()
export class ChatService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly executorId = randomUUID();
  private readonly executions = new Map<string, { abort: AbortController; done: Promise<void> }>();
  private scheduler?: ReturnType<typeof setInterval>;
  private ticking = false;
  private stopping = false;
  private get db() {
    return this.infrastructure.database.db;
  }

  constructor(
    @Inject(InfrastructureService) private readonly infrastructure: InfrastructureService,
    @Inject(ModulesService) private readonly modules: ModulesService,
    @Inject(IdempotencyService) private readonly idempotency: IdempotencyService,
    @Inject(AiService) private readonly ai: AiService,
    @Inject(API_ENV) private readonly env: ApiEnvironment,
  ) {}

  async onApplicationBootstrap() {
    if (!this.env.OPENAI_CHAT_MODEL || !this.env.OPENAI_API_KEY) return;
    await this.tick();
    this.scheduler = setInterval(() => {
      void this.tick().catch(() => this.log("chat.scheduler_failed"));
    }, this.env.CHAT_SWEEP_INTERVAL_MS);
    this.scheduler.unref();
  }
  async onModuleDestroy() {
    this.stopping = true;
    clearInterval(this.scheduler);
    while (this.ticking) await new Promise((resolve) => setTimeout(resolve, 25));
    for (const execution of this.executions.values()) execution.abort.abort();
    await Promise.allSettled([...this.executions.values()].map((e) => e.done));
  }
  private log(event: string, data: Record<string, unknown> = {}) {
    console.log(JSON.stringify({ level: "log", event, ...data }));
  }
  private notFound(): never {
    throw new ProductError(404, "NOT_FOUND", "Resource not found", "Percakapan tidak ditemukan.");
  }
  private unavailable(): never {
    throw new ProductError(
      503,
      "CHAT_UNAVAILABLE",
      "Chat unavailable",
      "Teman belajar belum tersedia. Coba lagi nanti.",
    );
  }
  private conflict(): never {
    throw new ProductError(
      409,
      "CHAT_RUN_ACTIVE",
      "Run active",
      "Tunggu jawaban selesai sebelum melanjutkan.",
    );
  }
  private scope(userId: string, moduleId: string, threadId: string) {
    return and(
      eq(chat_threads.id, threadId),
      eq(chat_threads.user_id, userId),
      eq(chat_threads.module_id, moduleId),
    );
  }
  private async ownedThread(
    userId: string,
    moduleId: string,
    threadId: string,
    includeDeleted = false,
  ) {
    await this.modules.validateChatScope(userId, moduleId);
    const [thread] = await this.db
      .select()
      .from(chat_threads)
      .where(
        and(
          this.scope(userId, moduleId, threadId),
          includeDeleted ? undefined : isNull(chat_threads.deleted_at),
        ),
      )
      .limit(1);
    if (!thread) this.notFound();
    return thread;
  }
  private async threadDtos(threads: (typeof chat_threads.$inferSelect)[]) {
    if (!threads.length) return [];
    const activeRuns = await this.db
      .select({ id: chat_runs.id, threadId: chat_runs.thread_id })
      .from(chat_runs)
      .where(
        and(
          inArray(
            chat_runs.thread_id,
            threads.map((thread) => thread.id),
          ),
          inArray(chat_runs.status, [...activeChatStatuses]),
        ),
      );
    const activeByThread = new Map(activeRuns.map((run) => [run.threadId, run.id]));
    return threads.map((thread) =>
      chatThreadSchema.parse({
        id: thread.id,
        moduleId: thread.module_id,
        title: thread.title,
        createdAt: thread.created_at.toISOString(),
        updatedAt: thread.updated_at.toISOString(),
        activeRunId: activeByThread.get(thread.id) ?? null,
      }),
    );
  }
  private async threadDto(thread: typeof chat_threads.$inferSelect) {
    const [dto] = await this.threadDtos([thread]);
    if (!dto) this.notFound();
    return dto;
  }
  async createThread(userId: string, moduleId: string, title = "Percakapan baru") {
    await this.modules.validateChatScope(userId, moduleId);
    const [thread] = await this.db
      .insert(chat_threads)
      .values({ user_id: userId, module_id: moduleId, title })
      .returning();
    if (!thread) this.unavailable();
    return this.threadDto(thread);
  }
  async listThreads(userId: string, moduleId: string, query: ChatPagination) {
    await this.modules.validateChatScope(userId, moduleId);
    const scope = `threads:${userId}:${moduleId}`;
    const cursor = readChatCursor(query.cursor, scope);
    if (cursor && typeof cursor.order !== "string")
      throw new ProductError(422, "VALIDATION_ERROR", "Invalid cursor", "Cursor tidak valid.");
    const date = cursor ? new Date(cursor.order) : undefined;
    const rows = await this.db
      .select()
      .from(chat_threads)
      .where(
        and(
          eq(chat_threads.user_id, userId),
          eq(chat_threads.module_id, moduleId),
          isNull(chat_threads.deleted_at),
          cursor && date
            ? or(
                lt(chat_threads.created_at, date),
                and(eq(chat_threads.created_at, date), lt(chat_threads.id, cursor.id)),
              )
            : undefined,
        ),
      )
      .orderBy(desc(chat_threads.created_at), desc(chat_threads.id))
      .limit(query.limit + 1);
    const page = chatPage(rows, query.limit, scope, (row) => ({
      id: row.id,
      order: row.created_at.toISOString(),
    }));
    return { ...page, data: await this.threadDtos(page.data) };
  }
  async getThread(userId: string, moduleId: string, threadId: string) {
    return this.threadDto(await this.ownedThread(userId, moduleId, threadId));
  }
  async renameThread(userId: string, moduleId: string, threadId: string, title: string) {
    await this.ownedThread(userId, moduleId, threadId);
    const [thread] = await this.db
      .update(chat_threads)
      .set({ title })
      .where(and(this.scope(userId, moduleId, threadId), isNull(chat_threads.deleted_at)))
      .returning();
    if (!thread) this.notFound();
    return this.threadDto(thread);
  }
  async deleteThread(userId: string, moduleId: string, threadId: string) {
    await this.ownedThread(userId, moduleId, threadId, true);
    await this.db.transaction(async (tx) => {
      await tx
        .select({ id: chat_threads.id })
        .from(chat_threads)
        .where(eq(chat_threads.id, threadId))
        .for("update");
      const [active] = await tx
        .select({ id: chat_runs.id })
        .from(chat_runs)
        .where(
          and(
            eq(chat_runs.thread_id, threadId),
            inArray(chat_runs.status, [...activeChatStatuses]),
          ),
        )
        .limit(1);
      if (active) this.conflict();
      await tx
        .update(chat_threads)
        .set({ deleted_at: sql`coalesce(${chat_threads.deleted_at},now())` })
        .where(eq(chat_threads.id, threadId));
    });
  }
  private async messageDtos(rows: (typeof chat_messages.$inferSelect)[]): Promise<ChatMessage[]> {
    const contexts = rows.length
      ? await this.db
          .select()
          .from(chat_message_contexts)
          .where(
            inArray(
              chat_message_contexts.message_id,
              rows.map((r) => r.id),
            ),
          )
      : [];
    const runs = rows.length
      ? await this.db
          .select({ id: chat_runs.id, status: chat_runs.status, errorCode: chat_runs.error_code })
          .from(chat_runs)
          .where(inArray(chat_runs.id, [...new Set(rows.map((row) => row.run_id))]))
      : [];
    const statusByRun = new Map(
      runs.map((run) => [
        run.id,
        { type: "data-run-status", data: { status: run.status, errorCode: run.errorCode } },
      ]),
    );
    return rows.map((row) =>
      chatMessageSchema.parse({
        id: row.id,
        threadId: row.thread_id,
        runId: row.run_id,
        sequence: row.sequence,
        role: row.role,
        parts:
          row.role === "assistant"
            ? [
                ...chatMessageParts(row.parts_json).filter(
                  (part) => part.type !== "data-run-status",
                ),
                statusByRun.get(row.run_id),
              ]
            : row.parts_json,
        contexts: contexts
          .filter((c) => c.message_id === row.id && c.kind === "page")
          .map((c) => c.reference_json),
        createdAt: row.created_at.toISOString(),
        availability: "available",
      }),
    );
  }
  async listMessages(userId: string, moduleId: string, threadId: string, query: ChatPagination) {
    await this.ownedThread(userId, moduleId, threadId);
    const scope = `messages:${userId}:${moduleId}:${threadId}`,
      cursor = readChatCursor(query.cursor, scope);
    if (cursor && typeof cursor.order !== "number")
      throw new ProductError(422, "VALIDATION_ERROR", "Invalid cursor", "Cursor tidak valid.");
    const rows = await this.db
      .select()
      .from(chat_messages)
      .where(
        and(
          eq(chat_messages.thread_id, threadId),
          cursor
            ? or(
                lt(chat_messages.sequence, Number(cursor.order)),
                and(
                  eq(chat_messages.sequence, Number(cursor.order)),
                  lt(chat_messages.id, cursor.id),
                ),
              )
            : undefined,
        ),
      )
      .orderBy(desc(chat_messages.sequence), desc(chat_messages.id))
      .limit(query.limit + 1);
    const page = chatPage(rows, query.limit, scope, (row) => ({ id: row.id, order: row.sequence }));
    return { ...page, data: await this.messageDtos(page.data) };
  }
  async getRun(userId: string, moduleId: string, threadId: string, runId: string) {
    await this.ownedThread(userId, moduleId, threadId);
    const [row] = await this.db
      .select()
      .from(chat_runs)
      .where(and(eq(chat_runs.id, runId), eq(chat_runs.thread_id, threadId)))
      .limit(1);
    if (!row) this.notFound();
    const [usage] = await this.db
      .select()
      .from(chat_run_usage)
      .where(eq(chat_run_usage.run_id, runId))
      .limit(1);
    return chatRunSchema.parse({
      id: row.id,
      threadId: row.thread_id,
      messageId: row.user_message_id,
      assistantMessageId: row.assistant_message_id,
      status: row.status,
      createdAt: row.created_at.toISOString(),
      startedAt: row.started_at?.toISOString() ?? null,
      finishedAt: row.finished_at?.toISOString() ?? null,
      errorCode: row.error_code,
      usage: usage
        ? {
            inputTokens: usage.input_tokens,
            outputTokens: usage.output_tokens,
            totalTokens: usage.total_tokens,
            coverage: usage.coverage,
          }
        : emptyUsage,
    });
  }
  async send(
    userId: string,
    moduleId: string,
    threadId: string,
    key: string,
    input: SendChatMessage,
  ) {
    await this.ownedThread(userId, moduleId, threadId);
    await this.modules.validateChatScope(
      userId,
      moduleId,
      input.pageContext?.surface === "node" ? input.pageContext.nodeId : undefined,
    );
    if ([...input.text].length > this.env.CHAT_INPUT_MAX_CODE_POINTS)
      throw new ProductError(
        422,
        "VALIDATION_ERROR",
        "Input too long",
        "Pesan melebihi batas panjang.",
      );
    if (input.references.length)
      throw new ProductError(
        403,
        "CHAT_CONTEXT_FORBIDDEN",
        "References unavailable",
        "Kutipan materi belum tersedia pada chat ini.",
      );
    if (input.retryOfRunId) {
      const run = await this.getRun(userId, moduleId, threadId, input.retryOfRunId);
      if (isChatRunActive(run.status) || run.status === "completed")
        throw new ProductError(
          422,
          "VALIDATION_ERROR",
          "Invalid retry",
          "Hanya jawaban yang terhenti dapat dicoba ulang.",
        );
    }
    const route = `/api/v1/modules/${moduleId}/chat/threads/${threadId}/messages`;
    const result = await this.idempotency
      .execute<{ data: ChatAcknowledgment }>(
        {
          userId,
          method: "POST",
          route,
          key,
          payloadHash: createHash("sha256").update(JSON.stringify(input)).digest("hex"),
          retentionMilliseconds: this.env.CHAT_IDEMPOTENCY_RETENTION_HOURS * 3600000,
        },
        async (tx) => {
          if (!this.env.CHAT_ENABLED || this.stopping) this.unavailable();
          // Reject oversized mandatory prompt before admitting a run/provider invocation.
          const model = this.ai.createChatModel();
          const mandatory = await model.getNumTokensFromMessages([
            new SystemMessage(learningPrompt),
            new HumanMessage(input.text),
          ]);
          if (mandatory.totalCount > this.env.CHAT_PROMPT_MAX_TOKENS)
            throw new ProductError(
              422,
              "VALIDATION_ERROR",
              "Prompt too large",
              "Pesan melebihi anggaran konteks.",
            );

          const [thread] = await tx
            .select()
            .from(chat_threads)
            .where(and(this.scope(userId, moduleId, threadId), isNull(chat_threads.deleted_at)))
            .for("update")
            .limit(1);
          if (!thread) this.notFound();
          const [active] = await tx
            .select({ id: chat_runs.id })
            .from(chat_runs)
            .where(
              and(
                eq(chat_runs.thread_id, threadId),
                inArray(chat_runs.status, [...activeChatStatuses]),
              ),
            )
            .limit(1);
          if (active) this.conflict();
          const runId = randomUUID(),
            messageId = randomUUID();
          await tx.insert(chat_runs).values({
            id: runId,
            thread_id: threadId,
            retry_of_run_id: input.retryOfRunId,
            deadline_at: sql`now() + ${this.env.CHAT_RUN_TIMEOUT_MS} * interval '1 millisecond'`,
          });
          await tx.insert(chat_messages).values({
            id: messageId,
            thread_id: threadId,
            run_id: runId,
            sequence: thread.next_sequence,
            role: "user",
            parts_json: [{ type: "text", text: input.text }],
          });
          if (input.pageContext)
            await tx
              .insert(chat_message_contexts)
              .values({ message_id: messageId, kind: "page", reference_json: input.pageContext });
          await tx
            .update(chat_runs)
            .set({ user_message_id: messageId })
            .where(eq(chat_runs.id, runId));
          await tx
            .update(chat_threads)
            .set({ next_sequence: thread.next_sequence + 2 })
            .where(eq(chat_threads.id, threadId));
          return {
            status: 202,
            body: {
              data: {
                messageId,
                runId,
                status: "queued",
                eventsUrl: `/api/v1/modules/${moduleId}/chat/threads/${threadId}/runs/${runId}/events`,
              },
            },
          };
        },
      )
      .catch((error) => {
        if (error instanceof ProductError) throw error;
        this.unavailable();
      });
    // The durable queue is the work owner. No response/socket callback starts execution.
    void this.tick().catch(() => this.log("chat.scheduler_failed"));
    return result.body;
  }
  async cancel(userId: string, moduleId: string, threadId: string, runId: string) {
    await this.getRun(userId, moduleId, threadId, runId);
    await this.db.transaction(async (tx) => {
      const [run] = await tx
        .select()
        .from(chat_runs)
        .where(eq(chat_runs.id, runId))
        .for("update")
        .limit(1);
      if (!run || !isChatRunActive(run.status)) return;
      if (run.status === "queued")
        await tx
          .update(chat_runs)
          .set({
            status: "cancelled",
            error_code: "USER_CANCELLED",
            cancel_requested_at: sql`now()`,
            finished_at: sql`now()`,
          })
          .where(eq(chat_runs.id, runId));
      else
        await tx
          .update(chat_runs)
          .set({ status: "cancelling", cancel_requested_at: sql`now()` })
          .where(eq(chat_runs.id, runId));
    });
    this.executions.get(runId)?.abort.abort();
    return this.getRun(userId, moduleId, threadId, runId);
  }

  private async tick() {
    if (this.ticking || this.stopping) return;
    this.ticking = true;
    try {
      // Minimum recovery required so a local restart cannot leave the M1 thread wedged.
      await this.db
        .update(chat_runs)
        .set({ status: "interrupted", error_code: "PROCESS_INTERRUPTED", finished_at: sql`now()` })
        .where(
          and(
            inArray(chat_runs.status, ["running", "cancelling"]),
            sql`${chat_runs.lease_expires_at} <= now()`,
          ),
        );
      await this.db
        .update(chat_runs)
        .set({ status: "timed_out", error_code: "RUN_TIMEOUT", finished_at: sql`now()` })
        .where(
          and(
            inArray(chat_runs.status, [...activeChatStatuses]),
            sql`${chat_runs.deadline_at} <= now()`,
          ),
        );
      while (
        !this.stopping &&
        this.executions.size < this.env.CHAT_MAX_EXECUTING_RUNS_PER_INSTANCE
      ) {
        const claimed = await this.db.transaction(async (tx) => {
          const [run] = await tx
            .select()
            .from(chat_runs)
            .where(eq(chat_runs.status, "queued"))
            .orderBy(asc(chat_runs.created_at))
            .for("update", { skipLocked: true })
            .limit(1);
          if (!run) return;
          const [updated] = await tx
            .update(chat_runs)
            .set({
              status: "running",
              executor_id: this.executorId,
              lease_epoch: run.lease_epoch + 1,
              lease_expires_at: sql`now() + ${this.env.CHAT_LEASE_MS} * interval '1 millisecond'`,
              heartbeat_at: sql`now()`,
              started_at: sql`now()`,
            })
            .where(eq(chat_runs.id, run.id))
            .returning();
          return updated;
        });
        if (!claimed) break;
        const abort = new AbortController();
        const done = this.execute(claimed, abort)
          .catch(() => this.log("chat.execution_failed", { runId: claimed.id }))
          .finally(() => this.executions.delete(claimed.id));
        this.executions.set(claimed.id, { abort, done });
      }
    } finally {
      this.ticking = false;
    }
  }
  private fence(run: RunRow) {
    return and(
      eq(chat_runs.id, run.id),
      eq(chat_runs.executor_id, this.executorId),
      eq(chat_runs.lease_epoch, run.lease_epoch),
      inArray(chat_runs.status, ["running", "cancelling"]),
      sql`${chat_runs.lease_expires_at} > now()`,
    );
  }
  private async promptMessages(run: RunRow, model: ReturnType<AiService["createChatModel"]>) {
    const [user] = await this.db
      .select()
      .from(chat_messages)
      .where(eq(chat_messages.id, run.user_message_id ?? ""))
      .limit(1);
    if (!user) throw new Error("Missing user message");
    const messages: BaseMessage[] = [new HumanMessage(textOf(user.parts_json))];
    let beforeSequence = user.sequence;
    // Read recent completed pairs incrementally; never materialize an entire long thread.
    while (true) {
      const rows = await this.db
        .select({ message: chat_messages })
        .from(chat_messages)
        .innerJoin(chat_runs, eq(chat_runs.id, chat_messages.run_id))
        .where(
          and(
            eq(chat_messages.thread_id, run.thread_id),
            eq(chat_runs.status, "completed"),
            lt(chat_messages.sequence, beforeSequence),
          ),
        )
        .orderBy(desc(chat_messages.sequence))
        .limit(20);
      for (let i = 0; i + 1 < rows.length; i += 2) {
        const assistant = rows[i]?.message,
          previous = rows[i + 1]?.message;
        if (
          !assistant ||
          !previous ||
          assistant.role !== "assistant" ||
          previous.role !== "user" ||
          assistant.run_id !== previous.run_id
        )
          continue;
        const pair = [
          new HumanMessage(textOf(previous.parts_json)),
          new AIMessage(textOf(assistant.parts_json)),
        ];
        const budget = await model.getNumTokensFromMessages([
          new SystemMessage(learningPrompt),
          ...pair,
          ...messages,
        ]);
        if (budget.totalCount > this.env.CHAT_PROMPT_MAX_TOKENS) return messages;
        messages.unshift(...pair);
      }
      const last = rows.at(-1);
      if (rows.length < 20 || !last) break;
      beforeSequence = last.message.sequence;
    }
    return messages;
  }
  private async persist(
    run: RunRow,
    assistantId: string,
    text: string,
    terminal?: { status: ChatRunStatus; errorCode: ChatRunError | null; usage: ChatUsage },
  ) {
    return this.db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(chat_runs)
        .where(this.fence(run))
        .for("update")
        .limit(1);
      if (!current) return false;
      const status = terminal
        ? current.status === "cancelling"
          ? "cancelled"
          : terminal.status
        : current.status;
      const errorCode = status === "cancelled" ? "USER_CANCELLED" : (terminal?.errorCode ?? null);
      const parts: ChatPart[] = [{ type: "text", text }];
      if (terminal) parts.push({ type: "data-run-status", data: { status, errorCode } });
      await tx
        .update(chat_messages)
        .set({ parts_json: parts, content_revision: sql`${chat_messages.content_revision}+1` })
        .where(eq(chat_messages.id, assistantId));
      await tx
        .update(chat_runs)
        .set({
          snapshot_sequence: sql`${chat_runs.snapshot_sequence}+1`,
          ...(terminal ? { status, error_code: errorCode, finished_at: sql`now()` } : {}),
        })
        .where(eq(chat_runs.id, run.id));
      if (terminal)
        await tx
          .insert(chat_run_usage)
          .values({
            run_id: run.id,
            call_id: "model-1",
            provider: "openai",
            model: this.env.OPENAI_CHAT_MODEL ?? "unavailable",
            input_tokens: terminal.usage.inputTokens,
            output_tokens: terminal.usage.outputTokens,
            total_tokens: terminal.usage.totalTokens,
            coverage: terminal.usage.coverage,
          })
          .onConflictDoNothing();
      return true;
    });
  }
  private async execute(run: RunRow, abort: AbortController) {
    const startedAt = performance.now();
    const assistantId = randomUUID();
    let text = "",
      usage = { ...emptyUsage },
      outputLimited = false,
      callCount = 0,
      toolCount = 0,
      lastSnapshot = 0;
    let heartbeatBusy = false;
    const deadline = setTimeout(
      () => abort.abort(),
      Math.max(1, run.deadline_at.getTime() - Date.now()),
    );
    const heartbeat = setInterval(() => {
      if (heartbeatBusy) return;
      heartbeatBusy = true;
      void this.db
        .update(chat_runs)
        .set({
          heartbeat_at: sql`now()`,
          lease_expires_at: sql`now() + ${this.env.CHAT_LEASE_MS} * interval '1 millisecond'`,
        })
        .where(this.fence(run))
        .returning({ status: chat_runs.status })
        .then((rows) => {
          if (!rows[0] || rows[0].status === "cancelling") abort.abort();
        })
        .catch(() => abort.abort())
        .finally(() => {
          heartbeatBusy = false;
        });
    }, this.env.CHAT_HEARTBEAT_MS);
    try {
      const [thread] = await this.db
        .select()
        .from(chat_threads)
        .where(eq(chat_threads.id, run.thread_id))
        .limit(1);
      if (!thread || thread.deleted_at) throw new Error("Thread unavailable");
      await this.modules.validateChatScope(thread.user_id, thread.module_id);
      await this.db.transaction(async (tx) => {
        const [current] = await tx
          .select()
          .from(chat_runs)
          .where(this.fence(run))
          .for("update")
          .limit(1);
        if (!current) throw new Error("Lease lost");
        const [user] = await tx
          .select({ sequence: chat_messages.sequence })
          .from(chat_messages)
          .where(eq(chat_messages.id, run.user_message_id ?? ""))
          .limit(1);
        if (!user) throw new Error("Missing user message");
        await tx.insert(chat_messages).values({
          id: assistantId,
          thread_id: run.thread_id,
          run_id: run.id,
          sequence: user.sequence + 1,
          role: "assistant",
        });
        await tx
          .update(chat_runs)
          .set({ assistant_message_id: assistantId })
          .where(eq(chat_runs.id, run.id));
      });
      const model = this.ai.createChatModel();
      const messages = await this.promptMessages(run, model);
      const agent = createLearningAgent(model);
      const stream = await agent.stream(
        { messages },
        {
          signal: abort.signal,
          streamMode: ["values", "messages", "tools"],
          callbacks: [
            {
              handleLLMStart: () => {
                callCount += 1;
              },
              handleToolStart: () => {
                toolCount += 1;
              },
              handleLLMEnd: (output) => {
                for (const generation of output.generations.flat()) {
                  if ("message" in generation) {
                    const message = generation.message as {
                      usage_metadata?: unknown;
                      response_metadata?: Record<string, unknown>;
                    };
                    usage = this.ai.normalizeUsage(message.usage_metadata);
                    const metadata = message.response_metadata;
                    outputLimited =
                      metadata?.finish_reason === "length" || metadata?.status === "incomplete";
                  }
                }
              },
            },
          ],
        },
      );
      const reader = toUIMessageStream(stream).getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          // M1 allowlist: never persist provider metadata, reasoning, or raw tool output.
          if (value.type === "error") throw new Error("Provider stream error");
          if (value.type === "text-delta") {
            text += value.delta;
            if (Date.now() - lastSnapshot >= this.env.CHAT_SNAPSHOT_INTERVAL_MS) {
              if (!(await this.persist(run, assistantId, text))) {
                abort.abort();
                throw new Error("Lease lost");
              }
              lastSnapshot = Date.now();
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
      if (abort.signal.aborted) throw new Error("Run aborted");
      await this.persist(run, assistantId, text, {
        status: outputLimited ? "failed" : "completed",
        errorCode: outputLimited ? "OUTPUT_LIMIT" : null,
        usage,
      });
    } catch {
      const timedOut = Date.now() >= run.deadline_at.getTime();
      await this.persist(run, assistantId, text, {
        status: this.stopping ? "interrupted" : timedOut ? "timed_out" : "failed",
        errorCode: this.stopping
          ? "PROCESS_INTERRUPTED"
          : timedOut
            ? "RUN_TIMEOUT"
            : "PROVIDER_ERROR",
        usage,
      });
    } finally {
      clearInterval(heartbeat);
      clearTimeout(deadline);
      const [finalRun] = await this.db
        .select({ status: chat_runs.status, errorCode: chat_runs.error_code })
        .from(chat_runs)
        .where(eq(chat_runs.id, run.id))
        .limit(1);
      this.log("chat.run_finished", {
        status: finalRun?.status,
        errorCode: finalRun?.errorCode,
        durationMs: Math.round(performance.now() - startedAt),
        runId: run.id,
        threadId: run.thread_id,
        modelCallCount: callCount,
        toolCallCount: toolCount,
        usageCoverage: usage.coverage,
      });
    }
  }

  /** M1: serve committed text snapshots as UI deltas. Pub/sub delivery is hardened in M2. */
  async streamSnapshot(userId: string, moduleId: string, threadId: string, runId: string) {
    const run = await this.getRun(userId, moduleId, threadId, runId);
    const [message] = run.assistantMessageId
      ? await this.db
          .select()
          .from(chat_messages)
          .where(eq(chat_messages.id, run.assistantMessageId))
          .limit(1)
      : [];
    return { run, text: message ? textOf(message.parts_json) : "" };
  }
}
