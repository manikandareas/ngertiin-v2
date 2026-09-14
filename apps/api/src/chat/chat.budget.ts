import { randomUUID } from "node:crypto";
import { type AIMessage, type BaseMessage, SystemMessage } from "@langchain/core/messages";
import type { ChatOpenAI } from "@langchain/openai";
import type { ChatRunError, ChatUsage } from "@ngertiin/contracts/api";
import type { ApiEnvironment } from "@ngertiin/contracts/environment";
import type { AiService } from "../ai/ai.service.js";
import { LearningRunError } from "./chat.errors.js";
import { promptTokenCount } from "./chat-multimodal.js";
import type { ExecutionBudget } from "./learning.agent.js";

type ExecutionContext = {
  calls: Map<string, ChatUsage>;
  deadlineAt: Date;
  signal: AbortSignal;
  assertActive(): void;
  save(): Promise<void>;
};

/** Per-run model/tool limits and usage; persistence stays with the executor. */
export class ChatExecutionBudget implements ExecutionBudget {
  modelCallCount = 0;
  toolCallCount = 0;
  outputLimited = false;
  failure?: ChatRunError;
  private streamStarted = false;
  private readonly outputReservations = new Map<string, number>();

  constructor(
    private readonly ai: AiService,
    private readonly env: ApiEnvironment,
    private readonly context: ExecutionContext,
  ) {}

  private fail(code: ChatRunError): never {
    this.failure = code;
    throw new LearningRunError(code);
  }

  async beforeCall(
    messages: BaseMessage[],
    maxOutputTokens?: number,
  ): Promise<{ callId: string; model: ChatOpenAI; systemMessage?: SystemMessage }> {
    this.context.assertActive();
    if (this.modelCallCount >= this.env.CHAT_AGENT_MAX_STEPS) this.fail("STEP_LIMIT");
    const remaining = this.remainingOutputTokens();
    if (remaining <= 0) this.fail("OUTPUT_LIMIT");
    const maxTokens = Math.min(remaining, maxOutputTokens ?? remaining);
    // Main agent calls receive the remaining budget as instructions too; the
    // provider's maxTokens alone only enforces a hard cutoff. Reviews stay scoped.
    const first = messages[0];
    let systemMessage: SystemMessage | undefined;
    if (maxOutputTokens === undefined && first?.type === "system") {
      const content =
        typeof first.content === "string"
          ? [{ type: "text" as const, text: first.content }]
          : first.content;
      systemMessage = new SystemMessage({
        content: [
          ...content,
          {
            type: "text",
            text: `Sisa anggaran output untuk panggilan ini maksimal ${maxTokens} token. Rencanakan jawaban utuh dengan target sekitar ${Math.floor(maxTokens * 0.7)} token atau kurang agar ada ruang untuk penutup. Ini batas maksimum, bukan target panjang; tetap ringkas untuk pertanyaan sederhana. Untuk permintaan mendalam, prioritaskan konsep utama, batasi jumlah bagian, dan selesaikan kalimat serta penjelasan sebelum batas. Jangan menyebut anggaran token kepada pengguna.`,
          },
        ],
      });
    }
    if (systemMessage) messages = [systemMessage, ...messages.slice(1)];
    const prompt = await promptTokenCount(this.ai.createChatModel(), messages);
    if (prompt > this.env.CHAT_PROMPT_MAX_TOKENS) throw new LearningRunError("CONTEXT_LIMIT");
    this.context.assertActive();
    const callId = randomUUID();
    this.context.calls.set(callId, {
      inputTokens: null,
      outputTokens: null,
      totalTokens: null,
      coverage: "unavailable",
    });
    this.outputReservations.set(callId, maxTokens);
    this.modelCallCount += 1;
    // Persist an unknown call before invoking the provider, including crash coverage.
    await this.context.save();
    const model = this.ai.createChatModel({
      onStream: () => {
        this.streamStarted = true;
      },
      maxTokens,
      timeout: Math.max(1, this.context.deadlineAt.getTime() - Date.now()),
    });
    return { callId, model, systemMessage };
  }

  private remainingOutputTokens(): number {
    const spent = [...this.context.calls.entries()].reduce(
      // Unknown usage consumes the full reservation for that call.
      (sum, [id, usage]) =>
        sum +
        (usage.outputTokens ?? this.outputReservations.get(id) ?? this.env.CHAT_OUTPUT_MAX_TOKENS),
      0,
    );
    return this.env.CHAT_OUTPUT_MAX_TOKENS - spent;
  }

  canInspectImage(): boolean {
    // Reserve 400 review tokens plus at least 500 tokens and one step for the answer.
    return (
      this.modelCallCount + 1 < this.env.CHAT_AGENT_MAX_STEPS &&
      this.remainingOutputTokens() >= 900 &&
      !this.context.signal.aborted
    );
  }

  canFallback() {
    return (
      !this.streamStarted &&
      this.modelCallCount === 1 &&
      this.toolCallCount === 0 &&
      !this.context.signal.aborted
    );
  }

  rejectedCall(callId: string) {
    this.context.calls.set(callId, {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      coverage: "complete",
    });
    this.modelCallCount -= 1;
  }

  async afterCall(callId: string, message: AIMessage, trackOutputLimit = true): Promise<void> {
    this.context.assertActive();
    this.context.calls.set(callId, this.ai.normalizeUsage(message.usage_metadata));
    const metadata = message.response_metadata;
    this.outputLimited ||=
      trackOutputLimit &&
      (metadata?.finish_reason === "length" || metadata?.status === "incomplete");
    await this.context.save();
  }

  onCallError(error: unknown): void {
    if (!this.context.signal.aborted)
      this.failure ??=
        error instanceof LearningRunError ? error.code : this.ai.normalizeChatError(error);
  }

  beforeToolCall(): void {
    this.context.assertActive();
    if (this.toolCallCount >= this.env.CHAT_TOOL_MAX_CALLS) this.fail("STEP_LIMIT");
    this.toolCallCount += 1;
  }
}
