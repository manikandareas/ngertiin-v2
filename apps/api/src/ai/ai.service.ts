import { ChatOpenAI } from "@langchain/openai";
import { Inject, Injectable } from "@nestjs/common";
import type { ChatRunError, ChatUsage } from "@ngertiin/contracts/api";
import type { ApiEnvironment } from "@ngertiin/contracts/environment";
import { API_ENV } from "../config.js";
import { ProductError } from "../http/product-error.js";

@Injectable()
export class AiService {
  constructor(@Inject(API_ENV) private readonly env: ApiEnvironment) {}

  createChatModel(options?: { maxTokens: number; timeout: number }) {
    if (!this.env.OPENAI_API_KEY || !this.env.OPENAI_CHAT_MODEL) {
      throw new ProductError(
        503,
        "CHAT_UNAVAILABLE",
        "Chat unavailable",
        "Teman belajar belum tersedia.",
      );
    }
    return new ChatOpenAI({
      apiKey: this.env.OPENAI_API_KEY,
      model: this.env.OPENAI_CHAT_MODEL,
      useResponsesApi: true,
      maxTokens: options?.maxTokens ?? this.env.CHAT_OUTPUT_MAX_TOKENS,
      timeout: Math.min(
        this.env.CHAT_PROVIDER_TIMEOUT_MS,
        options?.timeout ?? this.env.CHAT_RUN_TIMEOUT_MS,
      ),
      maxRetries: this.env.CHAT_PROVIDER_MAX_RETRIES,
      // Do not persist conversations with the provider; our database owns history.
      modelKwargs: { store: false },
    });
  }

  normalizeChatError(error: unknown): ChatRunError {
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
