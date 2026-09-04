export type SourceErrorCategory = "context_missing" | "context_invalid";

const errorMessages: Record<SourceErrorCategory, string> = {
  context_missing: "The requested source context could not be found.",
  context_invalid: "The requested source context is not valid for generation.",
};

export class SourceError extends Error {
  constructor(
    readonly category: SourceErrorCategory,
    cause?: unknown,
  ) {
    super(errorMessages[category], { cause });
    this.name = "SourceError";
  }
}
