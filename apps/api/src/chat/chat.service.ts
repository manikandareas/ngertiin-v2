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
  type ChatCitationSnapshot,
  type ChatMaterialTarget,
  type ChatMessage,
  type ChatPagination,
  type ChatPart,
  type ChatRunError,
  type ChatRunStatus,
  type ChatUsage,
  chatCitationSnapshotSchema,
  chatMessageSchema,
  chatPageContextSchema,
  chatPartSchema,
  chatRunSchema,
  chatThreadSchema,
  isChatRunActive,
  type SendChatMessage,
} from "@ngertiin/contracts/api";
import type { ApiEnvironment } from "@ngertiin/contracts/environment";
import {
  chat_admission_slots,
  chat_message_contexts,
  chat_messages,
  chat_run_usage,
  chat_runs,
  chat_threads,
  users,
} from "@ngertiin/database";
import {
  and,
  asc,
  count,
  desc,
  eq,
  getTableColumns,
  inArray,
  isNull,
  lt,
  or,
  sql,
} from "drizzle-orm";
import { AiService } from "../ai/ai.service.js";
import { API_ENV } from "../config.js";
import { ProductError } from "../http/product-error.js";
import { IdempotencyService } from "../idempotency/idempotency.service.js";
import { InfrastructureService } from "../infrastructure/infrastructure.service.js";
import { KnowledgeService } from "../knowledge/knowledge.service.js";
import { ModulesService } from "../modules/modules.service.js";
import { ChatExecutionBudget } from "./chat.budget.js";
import { chatFailureStatus, withAbortGrace } from "./chat.execution.js";
import { chatPage, readChatCursor } from "./chat.pagination.js";
import { ChatPubSub } from "./chat.pubsub.js";
import {
  type ChatEventResponse,
  type ChatSnapshot,
  chatSnapshotFrames,
  streamChatSnapshots,
} from "./chat.stream.js";
import { createLearningAgent, LearningRunError } from "./learning.agent.js";
import { LearningEvidence, materialPrompt } from "./learning.context.js";
import { learningPrompt } from "./prompts/learning.prompt.js";
import { readExcerptTool } from "./tools/read-excerpt.tool.js";
import { readProgressTool } from "./tools/read-progress.tool.js";
import { searchModuleMaterialsTool } from "./tools/search-module-materials.tool.js";

type RunRow = typeof chat_runs.$inferSelect;
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
  private readonly pubsub: ChatPubSub;
  private scheduler?: ReturnType<typeof setInterval>;
  private ticking = false;
  private stopping = false;
  private get db() {
    return this.infrastructure.database.db;
  }

  constructor(
    @Inject(InfrastructureService) private readonly infrastructure: InfrastructureService,
    @Inject(ModulesService) private readonly modules: ModulesService,
    @Inject(KnowledgeService) private readonly knowledge: KnowledgeService,
    @Inject(IdempotencyService) private readonly idempotency: IdempotencyService,
    @Inject(AiService) private readonly ai: AiService,
    @Inject(API_ENV) private readonly env: ApiEnvironment,
  ) {
    this.pubsub = new ChatPubSub(env.REDIS_URL);
  }

  async onApplicationBootstrap() {
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
    for (const execution of this.executions.values())
      execution.abort.abort(new LearningRunError("PROCESS_INTERRUPTED"));
    await Promise.allSettled([...this.executions.values()].map((e) => e.done));
    this.pubsub.close();
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
  private rateLimited(seconds: number): never {
    throw new ProductError(
      429,
      "RATE_LIMITED",
      "Chat limit reached",
      "Teman belajar sedang sibuk. Tunggu sebentar, lalu coba lagi.",
      undefined,
      { resetAt: new Date(Date.now() + seconds * 1000).toISOString() },
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
  listMaterials(userId: string, moduleId: string, query: { nodeId?: string; after?: string }) {
    return this.modules.listChatMaterials(userId, moduleId, query);
  }
  previewMaterial(userId: string, moduleId: string, target: ChatMaterialTarget, start: number) {
    return this.knowledge.preview(userId, moduleId, target, start);
  }
  private async runEvidence(runId: string) {
    const rows = await this.db
      .select({ snapshot: chat_message_contexts.reference_json })
      .from(chat_message_contexts)
      .innerJoin(chat_messages, eq(chat_messages.id, chat_message_contexts.message_id))
      .where(and(eq(chat_messages.run_id, runId), eq(chat_message_contexts.kind, "material")));
    return [
      ...new Map(
        rows.map((row) => {
          const snapshot = chatCitationSnapshotSchema.parse(row.snapshot);
          return [snapshot.citation.id, snapshot] as const;
        }),
      ).values(),
    ];
  }
  private async canReadEvidence(
    userId: string,
    moduleId: string,
    snapshots: ChatCitationSnapshot[],
  ) {
    try {
      const authorized = new Set<string>();
      for (const snapshot of snapshots) {
        const reference = snapshot.citation.reference;
        const key =
          reference.kind === "activity"
            ? `activity:${reference.nodeId}:${reference.activityId}`
            : `source:${reference.sourceId}`;
        if (authorized.has(key)) continue;
        await this.modules.validateChatMaterial(userId, moduleId, reference);
        authorized.add(key);
      }
      return true;
    } catch (error) {
      if (error instanceof ProductError) return false;
      throw error;
    }
  }
  async getCitation(
    userId: string,
    moduleId: string,
    threadId: string,
    messageId: string,
    citationId: string,
  ) {
    await this.ownedThread(userId, moduleId, threadId);
    const [message] = await this.db
      .select()
      .from(chat_messages)
      .where(and(eq(chat_messages.id, messageId), eq(chat_messages.thread_id, threadId)))
      .limit(1);
    if (
      !message ||
      !chatMessageParts(message.parts_json).some(
        (part) => part.type === "data-citation" && part.data.id === citationId,
      )
    )
      this.notFound();
    const evidence = await this.runEvidence(message.run_id);
    if (!(await this.canReadEvidence(userId, moduleId, evidence))) this.notFound();
    const snapshot = evidence.find((item) => item.citation.id === citationId);
    if (!snapshot) this.notFound();
    return snapshot;
  }
  private evidenceRows(
    messageId: string,
    snapshots: ChatCitationSnapshot[],
    dependencyOnly: boolean,
  ) {
    return snapshots.map((snapshot) => {
      const hash = createHash("sha256")
        .update(`${messageId}:${snapshot.citation.id}`)
        .digest("hex");
      const id = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
      return {
        id,
        message_id: messageId,
        kind: "material",
        reference_json: snapshot,
        snapshot_text: snapshot.text,
        content_revision: snapshot.citation.reference.contentRevision,
        dependency_only: dependencyOnly,
      };
    });
  }
  private async messageDtos(
    rows: (typeof chat_messages.$inferSelect & {
      runStatus: ChatRunStatus;
      runErrorCode: string | null;
    })[],
  ): Promise<ChatMessage[]> {
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
                {
                  type: "data-run-status",
                  data: { status: row.runStatus, errorCode: row.runErrorCode },
                },
              ]
            : row.parts_json,
        contexts: contexts
          .filter((c) => c.message_id === row.id && c.kind === "page")
          .map((c) => c.reference_json),
        references: contexts
          .filter((c) => c.message_id === row.id && c.kind === "material" && !c.dependency_only)
          .map((c) => chatCitationSnapshotSchema.parse(c.reference_json).citation.reference),
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
    // Read text and its status in the same statement, including during finalization.
    const rows = await this.db
      .select({
        ...getTableColumns(chat_messages),
        runStatus: chat_runs.status,
        runErrorCode: chat_runs.error_code,
      })
      .from(chat_messages)
      .innerJoin(chat_runs, eq(chat_runs.id, chat_messages.run_id))
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
    const availability = new Map<string, boolean>();
    for (const row of page.data) {
      if (!availability.has(row.run_id))
        availability.set(
          row.run_id,
          await this.canReadEvidence(userId, moduleId, await this.runEvidence(row.run_id)),
        );
    }
    const data = await this.messageDtos(page.data);
    return {
      ...page,
      data: data.map((message) =>
        availability.get(message.runId)
          ? message
          : {
              ...message,
              parts: [],
              contexts: [],
              references: [],
              availability: "unavailable" as const,
            },
      ),
    };
  }
  async getRun(userId: string, moduleId: string, threadId: string, runId: string) {
    await this.ownedThread(userId, moduleId, threadId);
    const [row] = await this.db
      .select()
      .from(chat_runs)
      .where(and(eq(chat_runs.id, runId), eq(chat_runs.thread_id, threadId)))
      .limit(1);
    if (!row) this.notFound();
    const calls = await this.db
      .select()
      .from(chat_run_usage)
      .where(eq(chat_run_usage.run_id, runId));
    const usage = this.ai.aggregateUsage(
      calls.map((call) => ({
        inputTokens: call.input_tokens,
        outputTokens: call.output_tokens,
        totalTokens: call.total_tokens,
        coverage: call.coverage as ChatUsage["coverage"],
      })),
    );
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
      usage,
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
    if (input.references.length > this.env.CHAT_CONTEXT_MAX_REFERENCES)
      throw new ProductError(
        422,
        "VALIDATION_ERROR",
        "Too many references",
        "Terlalu banyak kutipan.",
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
    let reservation: string | undefined;
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
          if (this.stopping) this.unavailable();
          // Reject oversized mandatory prompt before admitting a run/provider invocation.
          const evidence: ChatCitationSnapshot[] = [];
          let remaining = this.env.CHAT_CONTEXT_MAX_CODE_POINTS;
          for (const reference of input.references) {
            const snapshot = await this.knowledge.readExcerpt(
              userId,
              moduleId,
              reference,
              Math.max(0, remaining),
            );
            remaining -= [...snapshot.text].length;
            if (remaining < 0)
              throw new ProductError(
                422,
                "VALIDATION_ERROR",
                "Context too large",
                "Kutipan terlalu panjang.",
              );
            evidence.push(snapshot);
          }
          const model = this.ai.createChatModel();
          const mandatory = await model.getNumTokensFromMessages([
            new SystemMessage(learningPrompt),
            new HumanMessage(input.text + materialPrompt(evidence)),
          ]);
          if (mandatory.totalCount > this.env.CHAT_PROMPT_MAX_TOKENS)
            throw new ProductError(
              422,
              "VALIDATION_ERROR",
              "Prompt too large",
              "Pesan melebihi anggaran konteks.",
            );

          const [slot] = await tx
            .select()
            .from(chat_admission_slots)
            .where(eq(chat_admission_slots.id, "global"))
            .for("update");
          if (!slot) this.unavailable();
          // Idempotency already holds a FK key-share lock on this user. Avoid a lock-upgrade deadlock.
          await tx
            .select({ id: users.id })
            .from(users)
            .where(eq(users.id, userId))
            .for("no key update");
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
          const [global] = await tx
            .select({ total: count() })
            .from(chat_runs)
            .where(inArray(chat_runs.status, [...activeChatStatuses]));
          const [user] = await tx
            .select({ total: count() })
            .from(chat_runs)
            .innerJoin(chat_threads, eq(chat_threads.id, chat_runs.thread_id))
            .where(
              and(
                eq(chat_threads.user_id, userId),
                inArray(chat_runs.status, [...activeChatStatuses]),
              ),
            );
          if (
            (global?.total ?? 0) >= this.env.CHAT_MAX_ACTIVE_RUNS_GLOBAL ||
            (user?.total ?? 0) >= this.env.CHAT_MAX_ACTIVE_RUNS_PER_USER
          )
            this.rateLimited(2);
          reservation = randomUUID();
          const retryAfter = await this.pubsub.reserve(
            userId,
            reservation,
            this.env.CHAT_RATE_LIMIT_PER_MINUTE,
          );
          if (retryAfter) {
            reservation = undefined;
            this.rateLimited(retryAfter);
          }
          const runId = randomUUID(),
            messageId = randomUUID();
          await tx.insert(chat_runs).values({
            id: runId,
            thread_id: threadId,
            retry_of_run_id: input.retryOfRunId,
            deadline_at: sql`clock_timestamp() + ${this.env.CHAT_RUN_TIMEOUT_MS} * interval '1 millisecond'`,
          });
          await tx.insert(chat_messages).values({
            id: messageId,
            thread_id: threadId,
            run_id: runId,
            sequence: thread.next_sequence,
            role: "user",
            parts_json: [{ type: "text", text: input.text }],
          });
          if (evidence.length)
            await tx
              .insert(chat_message_contexts)
              .values(this.evidenceRows(messageId, evidence, false));
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
      .catch(async (error) => {
        if (reservation)
          await this.pubsub
            .release(userId, reservation)
            .catch(() => this.log("chat.rate_release_failed"));
        if (error instanceof ProductError) throw error;
        this.unavailable();
      });
    // The durable queue is the work owner. No response/socket callback starts execution.
    void this.tick().catch(() => this.log("chat.scheduler_failed"));
    return result.body;
  }
  async cancel(userId: string, moduleId: string, threadId: string, runId: string) {
    await this.getRun(userId, moduleId, threadId, runId);
    const committed = await this.db.transaction(async (tx) => {
      const [run] = await tx
        .select()
        .from(chat_runs)
        .where(eq(chat_runs.id, runId))
        .for("update")
        .limit(1);
      if (!run || !isChatRunActive(run.status) || run.status === "cancelling") return;
      const [message] = run.assistant_message_id
        ? await tx
            .select()
            .from(chat_messages)
            .where(eq(chat_messages.id, run.assistant_message_id))
        : [];
      const text = message ? textOf(message.parts_json) : "";
      const [updated] = await tx
        .update(chat_runs)
        .set({
          status: run.status === "queued" ? "cancelled" : "cancelling",
          cancel_requested_at: sql`clock_timestamp()`,
          snapshot_sequence: sql`${chat_runs.snapshot_sequence}+1`,
          ...(run.status === "queued"
            ? { error_code: "USER_CANCELLED", finished_at: sql`clock_timestamp()` }
            : {}),
        })
        .where(eq(chat_runs.id, runId))
        .returning();
      return updated
        ? { snapshot: this.snapshot(updated, text), previous: this.snapshot(run, text) }
        : undefined;
    });
    if (committed) await this.publish(committed.snapshot, committed.previous);
    this.executions.get(runId)?.abort.abort(new LearningRunError("USER_CANCELLED"));
    return this.getRun(userId, moduleId, threadId, runId);
  }

  private async tick() {
    if (this.ticking || this.stopping) return;
    this.ticking = true;
    try {
      await this.sweep();
      while (
        !this.stopping &&
        this.env.OPENAI_CHAT_MODEL &&
        this.env.OPENAI_API_KEY &&
        this.executions.size < this.env.CHAT_MAX_EXECUTING_RUNS_PER_INSTANCE
      ) {
        const claimed = await this.db.transaction(async (tx) => {
          const [run] = await tx
            .select()
            .from(chat_runs)
            .where(
              and(
                eq(chat_runs.status, "queued"),
                sql`${chat_runs.deadline_at} > clock_timestamp()`,
              ),
            )
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
              lease_expires_at: sql`clock_timestamp() + ${this.env.CHAT_LEASE_MS} * interval '1 millisecond'`,
              heartbeat_at: sql`clock_timestamp()`,
              started_at: sql`clock_timestamp()`,
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
      sql`${chat_runs.lease_expires_at} > clock_timestamp()`,
    );
  }
  private async promptMessages(
    run: RunRow,
    model: ReturnType<AiService["createChatModel"]>,
    scope: { userId: string; moduleId: string },
    evidence: LearningEvidence,
  ) {
    const [user] = await this.db
      .select()
      .from(chat_messages)
      .where(eq(chat_messages.id, run.user_message_id ?? ""))
      .limit(1);
    if (!user) throw new Error("Missing user message");
    const currentEvidence = await this.runEvidence(run.id);
    if (!(await this.canReadEvidence(scope.userId, scope.moduleId, currentEvidence)))
      this.notFound();
    for (const snapshot of currentEvidence) evidence.add(snapshot);
    const pageRows = await this.db
      .select()
      .from(chat_message_contexts)
      .where(
        and(eq(chat_message_contexts.message_id, user.id), eq(chat_message_contexts.kind, "page")),
      );
    const page = pageRows[0] ? chatPageContextSchema.parse(pageRows[0].reference_json) : undefined;
    const messages: BaseMessage[] = [
      new HumanMessage(
        textOf(user.parts_json) +
          materialPrompt(currentEvidence) +
          (page ? `\nMetadata halaman saat pesan dikirim: ${JSON.stringify(page)}` : ""),
      ),
    ];
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
        const dependencies = await this.runEvidence(previous.run_id);
        if (!(await this.canReadEvidence(scope.userId, scope.moduleId, dependencies))) continue;
        const pair = [
          new HumanMessage(textOf(previous.parts_json) + materialPrompt(dependencies)),
          new AIMessage(textOf(assistant.parts_json)),
        ];
        const budget = await model.getNumTokensFromMessages([
          new SystemMessage(learningPrompt),
          ...pair,
          ...messages,
        ]);
        if (budget.totalCount > this.env.CHAT_PROMPT_MAX_TOKENS) return messages;
        for (const snapshot of dependencies) evidence.add(snapshot);
        messages.unshift(...pair);
      }
      const last = rows.at(-1);
      if (rows.length < 20 || !last) break;
      beforeSequence = last.message.sequence;
    }
    return messages;
  }
  private snapshot(run: RunRow, text: string): ChatSnapshot {
    return {
      run: {
        id: run.id,
        assistantMessageId: run.assistant_message_id,
        status: run.status,
        errorCode: run.error_code as ChatRunError | null,
      },
      text,
      sequence: run.snapshot_sequence,
    };
  }
  private async publish(snapshot: ChatSnapshot, previous?: ChatSnapshot) {
    await this.pubsub
      .publish(snapshot.run.id, snapshot.sequence, chatSnapshotFrames(snapshot, previous))
      .catch(() => this.log("chat.publish_failed", { runId: snapshot.run.id }));
  }
  private async persist(
    run: RunRow,
    assistantId: string,
    text: string,
    calls: Map<string, ChatUsage>,
    terminal?: { status: ChatRunStatus; errorCode: ChatRunError | null },
    evidence: ChatCitationSnapshot[] = [],
  ) {
    const committed = await this.db.transaction(async (tx) => {
      const [locked] = await tx
        .select({
          run: chat_runs,
          expired: sql<boolean>`${chat_runs.deadline_at} <= clock_timestamp()`,
        })
        .from(chat_runs)
        .where(this.fence(run))
        .for("update")
        .limit(1);
      if (!locked) return;
      const current = locked.run;
      if (locked.expired) terminal = { status: "timed_out", errorCode: "RUN_TIMEOUT" };
      const [message] = await tx
        .select()
        .from(chat_messages)
        .where(eq(chat_messages.id, assistantId));
      const previous = {
        ...this.snapshot(current, message ? textOf(message.parts_json) : ""),
        citations: message
          ? chatMessageParts(message.parts_json).flatMap((part) =>
              part.type === "data-citation" ? [part.data] : [],
            )
          : [],
      };
      let status = current.status;
      if (terminal) status = current.status === "cancelling" ? "cancelled" : terminal.status;
      const errorCode = status === "cancelled" ? "USER_CANCELLED" : (terminal?.errorCode ?? null);
      if (message && evidence.length)
        await tx
          .insert(chat_message_contexts)
          .values(this.evidenceRows(assistantId, evidence, true))
          .onConflictDoNothing();
      const citations: ChatPart[] = evidence
        .filter((snapshot) => text.includes(`[[cite:${snapshot.citation.id}]]`))
        .map((snapshot) => ({
          type: "data-citation",
          id: snapshot.citation.id,
          data: snapshot.citation,
        }));
      const parts: ChatPart[] = [{ type: "text", text }, ...citations];
      if (terminal) parts.push({ type: "data-run-status", data: { status, errorCode } });
      if (message)
        await tx
          .update(chat_messages)
          .set({ parts_json: parts, content_revision: sql`${chat_messages.content_revision}+1` })
          .where(eq(chat_messages.id, assistantId));
      const [updated] = await tx
        .update(chat_runs)
        .set({
          snapshot_sequence: sql`${chat_runs.snapshot_sequence}+1`,
          ...(terminal
            ? { status, error_code: errorCode, finished_at: sql`clock_timestamp()` }
            : {}),
        })
        .where(eq(chat_runs.id, run.id))
        .returning();
      for (const [callId, usage] of calls) {
        const values = {
          input_tokens: usage.inputTokens,
          output_tokens: usage.outputTokens,
          total_tokens: usage.totalTokens,
          coverage:
            terminal && status === "cancelled" && usage.coverage !== "complete"
              ? "partial"
              : usage.coverage,
        };
        await tx
          .insert(chat_run_usage)
          .values({
            run_id: run.id,
            call_id: callId,
            provider: "openai",
            model: this.env.OPENAI_CHAT_MODEL ?? "unavailable",
            ...values,
          })
          .onConflictDoUpdate({
            target: [chat_run_usage.run_id, chat_run_usage.call_id],
            set: values,
          });
      }
      return updated
        ? {
            snapshot: {
              ...this.snapshot(updated, text),
              citations: citations.flatMap((part) =>
                part.type === "data-citation" ? [part.data] : [],
              ),
            },
            previous,
          }
        : undefined;
    });
    if (!committed) return false;
    await this.publish(committed.snapshot, committed.previous);
    return true;
  }
  private async sweep() {
    // Lock each expired run once. All terminal state, partial text and usage commit together.
    const committed = await this.db.transaction(async (tx) => {
      const expired = await tx
        .select()
        .from(chat_runs)
        .where(
          and(
            inArray(chat_runs.status, [...activeChatStatuses]),
            or(
              sql`${chat_runs.deadline_at} <= clock_timestamp()`,
              sql`${chat_runs.lease_expires_at} <= clock_timestamp()`,
              and(
                eq(chat_runs.status, "cancelling"),
                sql`${chat_runs.cancel_requested_at} + ${this.env.CHAT_CANCEL_GRACE_MS} * interval '1 millisecond' <= clock_timestamp()`,
              ),
            ),
          ),
        )
        .for("update", { skipLocked: true })
        .limit(100);
      const snapshots: { snapshot: ChatSnapshot; previous: ChatSnapshot }[] = [];
      for (const run of expired) {
        const [updated] = await tx
          .update(chat_runs)
          .set({
            status: sql`case when ${chat_runs.lease_expires_at} <= clock_timestamp() then 'interrupted'::chat_run_status
            when ${chat_runs.status} = 'cancelling' then 'cancelled'::chat_run_status else 'timed_out'::chat_run_status end`,
            error_code: sql`case when ${chat_runs.lease_expires_at} <= clock_timestamp() then 'PROCESS_INTERRUPTED'
            when ${chat_runs.status} = 'cancelling' then 'USER_CANCELLED' else 'RUN_TIMEOUT' end`,
            snapshot_sequence: sql`${chat_runs.snapshot_sequence}+1`,
            finished_at: sql`clock_timestamp()`,
          })
          .where(eq(chat_runs.id, run.id))
          .returning();
        if (!updated) continue;
        const [message] = run.assistant_message_id
          ? await tx
              .select()
              .from(chat_messages)
              .where(eq(chat_messages.id, run.assistant_message_id))
          : [];
        const text = message ? textOf(message.parts_json) : "";
        const snapshot = this.snapshot(updated, text);
        if (message)
          await tx
            .update(chat_messages)
            .set({
              parts_json: [
                ...chatMessageParts(message.parts_json).filter(
                  (part) => part.type !== "data-run-status",
                ),
                {
                  type: "data-run-status",
                  data: { status: updated.status, errorCode: updated.error_code },
                },
              ],
              content_revision: sql`${chat_messages.content_revision}+1`,
            })
            .where(eq(chat_messages.id, message.id));
        await tx
          .update(chat_run_usage)
          .set({ coverage: "partial" })
          .where(
            and(eq(chat_run_usage.run_id, run.id), eq(chat_run_usage.coverage, "unavailable")),
          );
        snapshots.push({ snapshot, previous: this.snapshot(run, text) });
      }
      return snapshots;
    });
    for (const { snapshot, previous } of committed) await this.publish(snapshot, previous);
  }
  private async execute(run: RunRow, abort: AbortController) {
    const startedAt = performance.now();
    const assistantId = randomUUID();
    const calls = new Map<string, ChatUsage>();
    const evidence = new LearningEvidence();
    let text = "";
    let lastSnapshot = 0;
    let heartbeatBusy = false,
      lastHeartbeat = Date.now(),
      finished = false;
    const assertActive = () => {
      if (finished || abort.signal.aborted)
        throw abort.signal.reason ?? new LearningRunError("PROCESS_INTERRUPTED");
    };
    const stop = (code: ChatRunError) => {
      abort.abort(new LearningRunError(code));
    };
    const deadline = setTimeout(
      () => stop("RUN_TIMEOUT"),
      Math.max(1, run.deadline_at.getTime() - Date.now()),
    );
    const heartbeat = setInterval(
      () => {
        if (heartbeatBusy || finished) return;
        heartbeatBusy = true;
        const renew = Date.now() - lastHeartbeat >= this.env.CHAT_HEARTBEAT_MS;
        const query = renew
          ? this.db
              .update(chat_runs)
              .set({
                heartbeat_at: sql`clock_timestamp()`,
                lease_expires_at: sql`clock_timestamp() + ${this.env.CHAT_LEASE_MS} * interval '1 millisecond'`,
              })
              .where(this.fence(run))
              .returning({ status: chat_runs.status })
          : this.db.select({ status: chat_runs.status }).from(chat_runs).where(this.fence(run));
        void query
          .then((rows) => {
            if (renew) lastHeartbeat = Date.now();
            if (!rows[0]) stop("PROCESS_INTERRUPTED");
            else if (rows[0].status === "cancelling") stop("USER_CANCELLED");
          })
          .catch(() => stop("PROCESS_INTERRUPTED"))
          .finally(() => {
            heartbeatBusy = false;
          });
      },
      Math.min(this.env.CHAT_HEARTBEAT_MS, this.env.CHAT_CANCEL_POLL_MS),
    );
    let executionScope: { userId: string; moduleId: string } | undefined;
    let savedText = "";
    let saving = Promise.resolve();
    const save = () => {
      saving = saving.then(async () => {
        assertActive();
        const snapshotText = text;
        if (executionScope) {
          await this.modules.validateChatScope(executionScope.userId, executionScope.moduleId);
          if (
            !(await this.canReadEvidence(
              executionScope.userId,
              executionScope.moduleId,
              evidence.values(),
            ))
          )
            this.notFound();
        }
        if (
          !(await this.persist(run, assistantId, snapshotText, calls, undefined, evidence.values()))
        ) {
          stop("PROCESS_INTERRUPTED");
          assertActive();
        }
        savedText = snapshotText;
        lastSnapshot = Date.now();
      });
      return saving;
    };
    const budget = new ChatExecutionBudget(this.ai, this.env, {
      calls,
      deadlineAt: run.deadline_at,
      signal: abort.signal,
      assertActive,
      save,
    });
    let snapshotBusy = false;
    const snapshotTimer = setInterval(() => {
      if (snapshotBusy || finished || abort.signal.aborted || text === savedText) return;
      snapshotBusy = true;
      void save()
        .catch(() => stop("PROCESS_INTERRUPTED"))
        .finally(() => {
          snapshotBusy = false;
        });
    }, this.env.CHAT_SNAPSHOT_INTERVAL_MS);
    const work = async () => {
      const [thread] = await this.db
        .select()
        .from(chat_threads)
        .where(eq(chat_threads.id, run.thread_id))
        .limit(1);
      if (!thread || thread.deleted_at) throw new Error("Thread unavailable");
      await this.modules.validateChatScope(thread.user_id, thread.module_id);
      assertActive();
      const initial = await this.db.transaction(async (tx) => {
        const [current] = await tx
          .select()
          .from(chat_runs)
          .where(this.fence(run))
          .for("update")
          .limit(1);
        if (!current || current.status === "cancelling")
          throw new LearningRunError("USER_CANCELLED");
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
        const [updated] = await tx
          .update(chat_runs)
          .set({
            assistant_message_id: assistantId,
            snapshot_sequence: sql`${chat_runs.snapshot_sequence}+1`,
          })
          .where(eq(chat_runs.id, run.id))
          .returning();
        if (!updated) throw new Error("Missing run");
        return this.snapshot(updated, "");
      });
      await this.publish(initial);
      assertActive();
      const model = this.ai.createChatModel();
      const context = Object.freeze({
        userId: thread.user_id,
        moduleId: thread.module_id,
        maxContextCodePoints: this.env.CHAT_CONTEXT_MAX_CODE_POINTS,
      });
      executionScope = context;
      const messages = await this.promptMessages(run, model, context, evidence);
      await save(); // Commit inherited dependencies before the first provider call.
      const agent = createLearningAgent(model, budget, [
        readExcerptTool(this.knowledge, context, evidence),
        readProgressTool(this.modules, context),
        searchModuleMaterialsTool(
          this.knowledge,
          context,
          evidence,
          this.env.CHAT_INPUT_MAX_CODE_POINTS,
        ),
      ]);
      const stream = await agent.stream(
        { messages },
        {
          signal: abort.signal,
          streamMode: ["values", "messages", "tools"],
          recursionLimit: this.env.CHAT_AGENT_MAX_STEPS * 4 + 10,
        },
      );
      const reader = toUIMessageStream(stream).getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          assertActive();
          if (done) break;
          // Only public text is persisted; provider metadata and reasoning never enter UI frames.
          if (value.type === "error") throw new Error("Provider stream error");
          if (value.type === "text-delta") {
            text += value.delta;
            if (Date.now() - lastSnapshot >= this.env.CHAT_SNAPSHOT_INTERVAL_MS) await save();
          }
        }
      } finally {
        reader.releaseLock();
      }
      assertActive();
    };
    try {
      await withAbortGrace(work(), abort.signal, this.env.CHAT_CANCEL_GRACE_MS);
      finished = true;
      const usage = this.ai.aggregateUsage([...calls.values()]);
      const outputLimited =
        budget.outputLimited || (usage.outputTokens ?? 0) >= this.env.CHAT_OUTPUT_MAX_TOKENS;
      await this.persist(
        run,
        assistantId,
        text,
        calls,
        {
          status: outputLimited ? "failed" : "completed",
          errorCode: outputLimited ? "OUTPUT_LIMIT" : null,
        },
        evidence.values(),
      );
    } catch (error) {
      finished = true; // Late provider callbacks cannot change snapshots or usage.
      const code =
        abort.signal.aborted && abort.signal.reason instanceof LearningRunError
          ? abort.signal.reason.code
          : (budget.failure ??
            (error instanceof LearningRunError ? error.code : this.ai.normalizeChatError(error)));
      await this.persist(
        run,
        assistantId,
        text,
        calls,
        {
          status: chatFailureStatus(code),
          errorCode: code,
        },
        evidence.values(),
      );
    } finally {
      finished = true;
      clearInterval(heartbeat);
      clearInterval(snapshotTimer);
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
        modelCallCount: budget.modelCallCount,
        toolCallCount: budget.toolCallCount,
        usageCoverage: this.ai.aggregateUsage([...calls.values()]).coverage,
      });
    }
  }

  async streamSnapshot(userId: string, moduleId: string, threadId: string, runId: string) {
    await this.ownedThread(userId, moduleId, threadId);
    // One SQL statement: text, status and sequence can never come from different commits.
    const [row] = await this.db
      .select({ run: chat_runs, message: chat_messages })
      .from(chat_runs)
      .leftJoin(chat_messages, eq(chat_messages.id, chat_runs.assistant_message_id))
      .where(and(eq(chat_runs.id, runId), eq(chat_runs.thread_id, threadId)))
      .limit(1);
    if (!row) this.notFound();
    if (!(await this.canReadEvidence(userId, moduleId, await this.runEvidence(runId))))
      this.notFound();
    return {
      ...this.snapshot(row.run, row.message ? textOf(row.message.parts_json) : ""),
      citations: row.message
        ? chatMessageParts(row.message.parts_json).flatMap((part) =>
            part.type === "data-citation" ? [part.data] : [],
          )
        : [],
    };
  }
  async stream(
    userId: string,
    moduleId: string,
    threadId: string,
    runId: string,
    res: ChatEventResponse,
  ) {
    const read = () => this.streamSnapshot(userId, moduleId, threadId, runId);
    const initial = await read(); // Authorize before subscribing to an internal channel.
    await streamChatSnapshots(
      res,
      read,
      async (receive, lost) => {
        if (!isChatRunActive(initial.run.status)) return () => {};
        try {
          return await this.pubsub.subscribe(runId, receive, lost);
        } catch {
          this.unavailable();
        }
      },
      this.env.CHAT_STREAM_BUFFER_MAX_BYTES,
      this.env.CHAT_SWEEP_INTERVAL_MS,
      async () => {
        await read();
      },
    );
  }
}
