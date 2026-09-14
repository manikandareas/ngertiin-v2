import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { stampRetryable } from "@langchain/core/errors";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { OutputParserException } from "@langchain/core/output_parsers";
import type { WorkerEnvironment } from "@ngertiin/contracts/environment";
import { z } from "zod";
import { AiError } from "./ai.error.js";
import { type AiModel, AiService, createModel } from "./ai.service.js";

const embeddingEnvironment = {
  OPENAI_API_KEY: "test-key",
  KNOWLEDGE_EMBEDDING_BATCH_SIZE: 32,
} as WorkerEnvironment;

const outputSchema = z.object({ value: z.string() }).strict();

function createService(error: unknown): AiService {
  const client = {
    withStructuredOutput: () => ({
      invoke: async () => {
        throw error;
      },
    }),
  } as unknown as BaseChatModel;
  const model: AiModel = { client, provider: "openai", modelId: "test-model" };
  return new AiService(model, embeddingEnvironment);
}

describe("AiService", () => {
  test("retries structured generation once after an invalid output", async () => {
    let calls = 0;
    const client = {
      withStructuredOutput: () => ({
        invoke: async () => {
          calls += 1;
          if (calls === 1) {
            throw new OutputParserException("The first output did not match the schema.");
          }
          return { value: "ok" };
        },
      }),
    } as unknown as BaseChatModel;
    const service = new AiService(
      { client, provider: "openai", modelId: "test-model" },
      embeddingEnvironment,
    );
    const retryLogs: string[] = [];
    const originalConsoleWarn = console.warn;
    console.warn = (...values: unknown[]) => retryLogs.push(values.map(String).join(" "));

    try {
      assert.deepEqual(
        await service.generateObject({
          schema: outputSchema,
          schemaName: "test_output",
          operation: "test_operation",
          prompt: "safe prompt",
        }),
        { value: "ok" },
      );
    } finally {
      console.warn = originalConsoleWarn;
    }

    assert.equal(calls, 2);
    assert.equal(retryLogs.length, 1);
    assert.partialDeepStrictEqual(JSON.parse(retryLogs[0] ?? "{}"), {
      level: "warn",
      event: "ai.invalid_output_retry",
      operation: "test_operation",
      provider: "openai",
      model: "test-model",
      attempt: 1,
      nextAttempt: 2,
    });
  });

  test("uses a strict Responses API function schema for GPT-5.6 Luna", async () => {
    const originalFetch = globalThis.fetch;
    let requestUrl: string | undefined;
    let requestBody: Record<string, unknown> | undefined;
    globalThis.fetch = async (input, init) => {
      requestUrl = input instanceof Request ? input.url : String(input);
      requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      const responseBody = requestUrl.endsWith("/responses")
        ? {
            id: "resp_test",
            object: "response",
            created_at: 0,
            status: "completed",
            error: null,
            incomplete_details: null,
            instructions: null,
            model: "gpt-5.6-luna",
            output: [
              {
                id: "fc_test",
                type: "function_call",
                status: "completed",
                arguments: '{"value":"ok"}',
                call_id: "call_test",
                name: "test_output",
              },
            ],
            parallel_tool_calls: true,
            previous_response_id: null,
            reasoning: { effort: "low", summary: null },
            store: true,
            temperature: null,
            text: { format: { type: "text" }, verbosity: "medium" },
            tool_choice: "auto",
            tools: [],
            top_p: null,
            truncation: "disabled",
            usage: {
              input_tokens: 1,
              input_tokens_details: { cached_tokens: 0 },
              output_tokens: 1,
              output_tokens_details: { reasoning_tokens: 0 },
              total_tokens: 2,
            },
          }
        : {
            id: "chatcmpl_test",
            object: "chat.completion",
            created: 0,
            model: "gpt-5.6-luna",
            choices: [
              {
                index: 0,
                message: {
                  role: "assistant",
                  content: null,
                  tool_calls: [
                    {
                      id: "call_test",
                      type: "function",
                      function: { name: "test_output", arguments: '{"value":"ok"}' },
                    },
                  ],
                },
                finish_reason: "tool_calls",
              },
            ],
            usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
          };
      return new Response(JSON.stringify(responseBody), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };

    try {
      const model = createModel({
        OPENAI_API_KEY: "test-key",
        OPENAI_MODEL: "gpt-5.6-luna",
      } as WorkerEnvironment);
      const service = new AiService(model, embeddingEnvironment);

      assert.deepEqual(
        await service.generateObject({
          schema: outputSchema,
          schemaName: "test_output",
          operation: "test_operation",
          prompt: "safe prompt",
        }),
        { value: "ok" },
      );
    } finally {
      globalThis.fetch = originalFetch;
    }

    assert.match(requestUrl ?? "", /\/responses$/);
    assert.deepEqual(requestBody?.reasoning, { effort: "low" });
    assert.equal(
      (requestBody?.tools as Array<Record<string, unknown>> | undefined)?.[0]?.strict,
      true,
    );
  });

  test("logs safe provider metadata without logging the provider message", async () => {
    const providerError = Object.assign(
      new Error("Incorrect API key: credential-sentinel-that-must-never-be-logged"),
      {
        name: "AuthenticationError",
        status: 401,
        code: "invalid_api_key",
        type: "invalid_request_error",
        param: "api_key",
        request_id: "req_safe123",
        lc_error_code: "MODEL_AUTHENTICATION",
      },
    );
    stampRetryable(providerError, false);
    const service = createService(providerError);
    const logLines: string[] = [];
    const originalConsoleError = console.error;
    console.error = (...values: unknown[]) => logLines.push(values.map(String).join(" "));

    let thrown: unknown;
    try {
      await service.generateObject({
        schema: outputSchema,
        schemaName: "test_output",
        operation: "test_operation",
        prompt: "safe prompt",
      });
    } catch (error) {
      thrown = error;
    } finally {
      console.error = originalConsoleError;
    }

    assert.ok(thrown instanceof AiError);
    assert.equal(thrown.category, "unexpected_ai_call");
    assert.equal(logLines.length, 1);
    const logLine = logLines[0];
    assert.ok(logLine);
    const entry = JSON.parse(logLine) as Record<string, unknown>;
    assert.partialDeepStrictEqual(entry, {
      level: "error",
      event: "ai.model_call_failed",
      category: "unexpected_ai_call",
      operation: "test_operation",
      provider: "openai",
      model: "test-model",
      errorType: "AuthenticationError",
      status: 401,
      code: "invalid_api_key",
      providerErrorType: "invalid_request_error",
      parameter: "api_key",
      requestId: "req_safe123",
      lcErrorCode: "MODEL_AUTHENTICATION",
      retryable: false,
    });
    assert.equal(typeof entry.latencyMs, "number");
    assert.doesNotMatch(logLine, /Incorrect API key/);
    assert.doesNotMatch(logLine, /credential-sentinel/);
    assert.doesNotMatch(logLine, /safe prompt/);
  });
});
