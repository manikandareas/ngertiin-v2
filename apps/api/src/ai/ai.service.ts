import { BaseCallbackHandler } from "@langchain/core/callbacks/base";
import type { ChatModelStreamEvent } from "@langchain/core/language_models/event";
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { Inject, Injectable } from "@nestjs/common";
import type { ChatRunError, ChatUsage } from "@ngertiin/contracts/api";
import type { ApiEnvironment } from "@ngertiin/contracts/environment";
import { validateEmbeddings } from "@ngertiin/shared/knowledge";
import { API_ENV } from "../config.js";
import { ProductError } from "../http/product-error.js";

@Injectable()
export class AiService {
  constructor(@Inject(API_ENV) private readonly env: ApiEnvironment) {}

  async embedMaterials(texts: string[], model: string, dimensions: number): Promise<number[][]> {
    const client = new OpenAIEmbeddings({
      apiKey: this.env.OPENAI_API_KEY,
      model,
      dimensions,
      timeout: 60000,
      maxRetries: 1,
      batchSize: this.env.KNOWLEDGE_EMBEDDING_BATCH_SIZE,
    });
    return validateEmbeddings(await client.embedDocuments(texts), texts.length, dimensions);
  }

  createChatModel(options?: {
    maxTokens: number;
    timeout: number;
    onStream?: () => void;
    onStreamEvent?: (event: ChatModelStreamEvent) => void | Promise<void>;
    maxToolCalls?: number;
  }) {
    if (!this.env.OPENAI_API_KEY || !this.env.OPENAI_CHAT_MODEL) {
      throw new ProductError(
        503,
        "CHAT_UNAVAILABLE",
        "Chat unavailable",
        "Teman belajar belum tersedia.",
      );
    }
    // Native events carry web-search progress and annotations that token callbacks omit.
    const streamHandler =
      options?.onStream || options?.onStreamEvent
        ? Object.assign(
            BaseCallbackHandler.fromMethods({
              handleLLMNewToken: options.onStream,
              handleChatModelStreamEvent: async (event) => {
                options.onStream?.();
                await options.onStreamEvent?.(event);
              },
            }),
            {
              lc_prefer_chat_model_stream_events: Boolean(options.onStreamEvent),
              awaitHandlers: true,
              raiseError: true,
            },
          )
        : undefined;
    return new ChatOpenAI({
      apiKey: this.env.OPENAI_API_KEY,
      model: this.env.OPENAI_CHAT_MODEL,
      useResponsesApi: true,
      callbacks: streamHandler ? [streamHandler] : undefined,
      maxTokens: options?.maxTokens ?? this.env.CHAT_OUTPUT_MAX_TOKENS,
      timeout: Math.min(
        this.env.CHAT_PROVIDER_TIMEOUT_MS,
        options?.timeout ?? this.env.CHAT_RUN_TIMEOUT_MS,
      ),
      maxRetries: this.env.CHAT_PROVIDER_MAX_RETRIES,
      // Do not persist conversations with the provider; our database owns history.
      modelKwargs: {
        store: false,
        ...(options?.maxToolCalls !== undefined ? { max_tool_calls: options.maxToolCalls } : {}),
      },
    });
  }

  normalizeChatError(error: unknown): ChatRunError {
    const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
    if (code === "context_length_exceeded") return "CONTEXT_LIMIT";
    if (
      [
        "invalid_file",
        "invalid_image",
        "file_parse_error",
        "file_read_error",
        "unsupported_file_type",
      ].includes(String(code))
    )
      return "ATTACHMENT_UNREADABLE";
    const name = error instanceof Error ? error.name : "";
    if (["TimeoutError", "APIConnectionTimeoutError"].includes(name)) return "RUN_TIMEOUT";
    if (name === "GraphRecursionError") return "STEP_LIMIT";
    return "PROVIDER_ERROR";
  }

  aggregateUsage(calls: ChatUsage[]): ChatUsage {
    const sum = (key: "inputTokens" | "outputTokens" | "totalTokens") => {
      const known = calls.flatMap((call) => (call[key] === null ? [] : [call[key]]));
      return known.length ? known.reduce((a, b) => a + b, 0) : null;
    };
    let coverage: ChatUsage["coverage"] = "unavailable";
    if (calls.length && calls.every((call) => call.coverage === "complete")) coverage = "complete";
    else if (calls.some((call) => call.coverage !== "unavailable")) coverage = "partial";
    return {
      inputTokens: sum("inputTokens"),
      outputTokens: sum("outputTokens"),
      totalTokens: sum("totalTokens"),
      coverage,
    };
  }

  normalizeUsage(metadata: unknown): ChatUsage {
    const value = metadata as
      | { input_tokens?: unknown; output_tokens?: unknown; total_tokens?: unknown }
      | undefined;
    const count = (n: unknown) =>
      typeof n === "number" && Number.isSafeInteger(n) && n >= 0 ? n : null;
    const inputTokens = count(value?.input_tokens),
      outputTokens = count(value?.output_tokens),
      totalTokens = count(value?.total_tokens);
    return {
      inputTokens,
      outputTokens,
      totalTokens,
      coverage:
        inputTokens !== null && outputTokens !== null && totalTokens !== null
          ? "complete"
          : inputTokens !== null || outputTokens !== null || totalTokens !== null
            ? "partial"
            : "unavailable",
    };
  }
}
