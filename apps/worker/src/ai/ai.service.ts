import { getRetryable } from "@langchain/core/errors";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { OutputParserException } from "@langchain/core/output_parsers";
import { ChatOpenAI } from "@langchain/openai";
import { Inject, Injectable } from "@nestjs/common";
import type { WorkerEnvironment } from "@ngertiin/contracts/environment";
import { ZodError, type ZodType } from "zod";
import { AiError, type AiErrorCategory } from "./ai.error.js";

export const AI_MODEL = Symbol("AI_MODEL");

export interface AiModel {
  readonly client: BaseChatModel;
  readonly provider: string;
  readonly modelId: string;
}

export interface GenerateObjectRequest<OutputValue extends Record<string, unknown>> {
  readonly schema: ZodType<OutputValue>;
  readonly schemaName: string;
  readonly operation: string;
  readonly prompt: string;
}

type ErrorRecord = Record<string, unknown>;

function asErrorRecord(value: unknown): ErrorRecord | undefined {
  return typeof value === "object" && value !== null ? (value as ErrorRecord) : undefined;
}

function safeToken(value: unknown): string | undefined {
  return typeof value === "string" && /^[A-Za-z0-9_.:-]{1,100}$/.test(value) ? value : undefined;
}

function safeParameter(value: unknown): string | undefined {
  return typeof value === "string" && /^[A-Za-z0-9_.:[\]-]{1,120}$/.test(value) ? value : undefined;
}

function errorStatus(error: unknown): number | undefined {
  const record = asErrorRecord(error);
  const response = asErrorRecord(record?.response);
  const status = record?.status ?? record?.statusCode ?? response?.status;
  return typeof status === "number" && Number.isInteger(status) && status >= 100 && status <= 599
    ? status
    : undefined;
}

function errorCode(error: unknown): string | undefined {
  const record = asErrorRecord(error);
  return safeToken(record?.code) ?? safeToken(asErrorRecord(record?.error)?.code);
}

function errorMetadata(error: unknown) {
  const record = asErrorRecord(error);
  const details = asErrorRecord(record?.error);
  return {
    errorType: safeToken(record?.name) ?? (error instanceof Error ? "Error" : "UnknownError"),
    status: errorStatus(error),
    code: errorCode(error),
    providerErrorType: safeToken(record?.type) ?? safeToken(details?.type),
    parameter: safeParameter(record?.param) ?? safeParameter(details?.param),
    requestId: safeToken(record?.request_id) ?? safeToken(record?.requestID),
    lcErrorCode: safeToken(record?.lc_error_code),
    retryable: getRetryable(error) ?? null,
  };
}

function classifyError(error: unknown): AiErrorCategory {
  if (error instanceof OutputParserException || error instanceof ZodError) return "invalid_output";
  if (getRetryable(error) === true || error instanceof DOMException) {
    return "provider_unavailable";
  }
  return "unexpected_ai_call";
}

export function createModel(environment: WorkerEnvironment): AiModel {
  return {
    client: new ChatOpenAI({
      apiKey: environment.OPENAI_API_KEY,
      model: environment.OPENAI_MODEL,
      maxRetries: 2,
      reasoning: { effort: "low" },
      timeout: 90_000,
      useResponsesApi: true,
    }),
    provider: "openai",
    modelId: environment.OPENAI_MODEL,
  };
}

@Injectable()
export class AiService {
  constructor(@Inject(AI_MODEL) private readonly model: AiModel) {}

  async generateObject<OutputValue extends Record<string, unknown>>(
    request: GenerateObjectRequest<OutputValue>,
  ): Promise<OutputValue> {
    const startedAt = performance.now();
    const structuredModel = this.model.client.withStructuredOutput<OutputValue>(request.schema, {
      method: "functionCalling",
      name: request.schemaName,
      strict: true,
    });
    let attempt = 1;

    while (true) {
      try {
        const output = await structuredModel.invoke(request.prompt);
        console.log(
          JSON.stringify({
            level: "log",
            event: "ai.model_call",
            operation: request.operation,
            provider: this.model.provider,
            model: this.model.modelId,
            attempt,
            latencyMs: Math.round(performance.now() - startedAt),
          }),
        );
        return output;
      } catch (error) {
        const category = classifyError(error);
        if (category === "invalid_output" && attempt === 1) {
          console.warn(
            JSON.stringify({
              level: "warn",
              event: "ai.invalid_output_retry",
              operation: request.operation,
              provider: this.model.provider,
              model: this.model.modelId,
              attempt,
              nextAttempt: attempt + 1,
              latencyMs: Math.round(performance.now() - startedAt),
              ...errorMetadata(error),
            }),
          );
          attempt += 1;
          continue;
        }
        console.error(
          JSON.stringify({
            level: "error",
            event: "ai.model_call_failed",
            category,
            operation: request.operation,
            provider: this.model.provider,
            model: this.model.modelId,
            attempt,
            latencyMs: Math.round(performance.now() - startedAt),
            ...errorMetadata(error),
          }),
        );
        throw new AiError(category, request.operation, error);
      }
    }
  }
}
