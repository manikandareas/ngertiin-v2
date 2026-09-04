export type AiErrorCategory = "invalid_output" | "provider_unavailable" | "unexpected_ai_call";

const errorMessages: Record<AiErrorCategory, string> = {
  invalid_output: "The AI response did not match the requested schema.",
  provider_unavailable: "The AI provider is temporarily unavailable.",
  unexpected_ai_call: "The AI call failed unexpectedly.",
};

export class AiError extends Error {
  constructor(
    readonly category: AiErrorCategory,
    readonly operation: string,
    cause?: unknown,
  ) {
    super(errorMessages[category], { cause });
    this.name = "AiError";
  }
}
