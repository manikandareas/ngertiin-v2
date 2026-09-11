import { ChatOpenAI } from "@langchain/openai";
import { Inject, Injectable } from "@nestjs/common";
import type { ChatUsage } from "@ngertiin/contracts/api";
import type { ApiEnvironment } from "@ngertiin/contracts/environment";
import { API_ENV } from "../config.js";
import { ProductError } from "../http/product-error.js";

@Injectable()
export class AiService {
  constructor(@Inject(API_ENV) private readonly env: ApiEnvironment) {}

  createChatModel() {
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
      maxTokens: this.env.CHAT_OUTPUT_MAX_TOKENS,
      timeout: Math.min(this.env.CHAT_PROVIDER_TIMEOUT_MS, this.env.CHAT_RUN_TIMEOUT_MS),
      maxRetries: this.env.CHAT_PROVIDER_MAX_RETRIES,
      // Do not persist conversations with the provider; our database owns history.
      modelKwargs: { store: false },
    });
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
