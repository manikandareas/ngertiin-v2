import type { GenerationFailure as PublicGenerationFailure } from "@ngertiin/contracts/api";
import { MODULE_GENERATION_STEPS, type ModuleGenerationStep } from "@ngertiin/contracts/jobs";
import { AiError } from "../ai/ai.error.js";
import { SourceError } from "../source/source.error.js";

type FailureCode = PublicGenerationFailure["code"];

const failureMessages: Record<FailureCode, string> = {
  GENERATION_PROVIDER_UNAVAILABLE: "The generation provider is temporarily unavailable.",
  GENERATION_INVALID_OUTPUT: "Generated content did not pass validation.",
  GENERATION_CONTEXT_INVALID: "The selected Source context is no longer valid.",
  GENERATION_FAILED: "Module generation could not be completed.",
};

export class ModuleGenerationFailure extends Error {
  constructor(
    readonly code: FailureCode,
    readonly step: ModuleGenerationStep,
    cause?: unknown,
  ) {
    super(failureMessages[code], { cause });
    this.name = "ModuleGenerationFailure";
  }

  get publicFailure(): PublicGenerationFailure {
    return {
      code: this.code,
      message: failureMessages[this.code],
      retryable: this.code !== "GENERATION_CONTEXT_INVALID",
    };
  }
}

export function invalidOutput(step: ModuleGenerationStep): never {
  throw new ModuleGenerationFailure("GENERATION_INVALID_OUTPUT", step);
}

export function invalidContext(step: ModuleGenerationStep = "extract_sources"): never {
  throw new ModuleGenerationFailure("GENERATION_CONTEXT_INVALID", step);
}

function isModuleGenerationStep(value: string): value is ModuleGenerationStep {
  return MODULE_GENERATION_STEPS.some(({ name }) => name === value);
}

function failureCodeFor(error: AiError): FailureCode {
  if (error.category === "invalid_output") return "GENERATION_INVALID_OUTPUT";
  if (error.category === "provider_unavailable") return "GENERATION_PROVIDER_UNAVAILABLE";
  return "GENERATION_FAILED";
}

function mappedFailure(
  error: unknown,
  fallbackStep: ModuleGenerationStep,
): ModuleGenerationFailure | undefined {
  if (error instanceof ModuleGenerationFailure) return error;
  if (error instanceof SourceError) {
    return new ModuleGenerationFailure("GENERATION_CONTEXT_INVALID", "extract_sources", error);
  }
  if (error instanceof AiError) {
    const step = isModuleGenerationStep(error.operation) ? error.operation : fallbackStep;
    return new ModuleGenerationFailure(failureCodeFor(error), step, error);
  }
  return undefined;
}

export function findModuleGenerationFailure(
  error: unknown,
  fallbackStep: ModuleGenerationStep,
): ModuleGenerationFailure | undefined {
  const pending = [error];
  const seen = new Set<unknown>();
  while (pending.length > 0) {
    const current = pending.shift();
    if (!current || seen.has(current)) continue;
    seen.add(current);

    const failure = mappedFailure(current, fallbackStep);
    if (failure) return failure;
    if (typeof current !== "object") continue;
    if (current instanceof AggregateError) pending.push(...current.errors);
    if ("error" in current) pending.push(current.error);
    if ("cause" in current) pending.push(current.cause);
  }
  return undefined;
}
