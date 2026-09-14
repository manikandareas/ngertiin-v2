import { randomUUID } from "node:crypto";
import type { AIMessage, BaseMessage } from "@langchain/core/messages";
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

  constructor(
    private readonly ai: AiService,
    private readonly env: ApiEnvironment,
    private readonly context: ExecutionContext,
  ) {}

  private fail(code: ChatRunError): never {
    this.failure = code;
    throw new LearningRunError(code);
  }

  async beforeCall(messages: BaseMessage[]): Promise<{ callId: string; model: ChatOpenAI }> {
    this.context.assertActive();
    if (this.modelCallCount >= this.env.CHAT_AGENT_MAX_STEPS) this.fail("STEP_LIMIT");
    // Unknown output cannot safely fund another model call.
    const spent = [...this.context.calls.values()].reduce(
      (sum, usage) => sum + (usage.outputTokens ?? this.env.CHAT_OUTPUT_MAX_TOKENS),
      0,
    );
    const remaining = this.env.CHAT_OUTPUT_MAX_TOKENS - spent;
    if (remaining <= 0) this.fail("OUTPUT_LIMIT");
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
    this.modelCallCount += 1;
    // Persist an unknown call before invoking the provider, including crash coverage.
    await this.context.save();
    const model = this.ai.createChatModel({
      onStream: () => {
        this.streamStarted = true;
      },
      maxTokens: remaining,
      timeout: Math.max(1, this.context.deadlineAt.getTime() - Date.now()),
    });
    return { callId, model };
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

  async afterCall(callId: string, message: AIMessage): Promise<void> {
    this.context.assertActive();
    this.context.calls.set(callId, this.ai.normalizeUsage(message.usage_metadata));
    const metadata = message.response_metadata;
    this.outputLimited ||=
      metadata?.finish_reason === "length" || metadata?.status === "incomplete";
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
