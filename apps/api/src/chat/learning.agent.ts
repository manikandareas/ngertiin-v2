import type { AIMessage, BaseMessage } from "@langchain/core/messages";
import type { StructuredToolInterface } from "@langchain/core/tools";
import type { ChatOpenAI } from "@langchain/openai";
import type { ChatRunError } from "@ngertiin/contracts/api";
import { createAgent, createMiddleware } from "langchain";
import { learningPrompt } from "./prompts/learning.prompt.js";

export class LearningRunError extends Error {
  constructor(readonly code: ChatRunError) {
    super(code);
  }
}

export type ExecutionBudget = {
  beforeCall(messages: BaseMessage[]): Promise<{ callId: string; model: ChatOpenAI }>;
  afterCall(callId: string, message: AIMessage): Promise<void>;
  beforeToolCall(): void;
  onCallError(error: unknown): void;
};

export function createLearningAgent(
  model: ChatOpenAI,
  budget: ExecutionBudget,
  tools: StructuredToolInterface[] = [],
) {
  return createAgent({
    model,
    tools,
    systemPrompt: learningPrompt,
    middleware: [
      createMiddleware({
        name: "LearningRunBudget",
        wrapModelCall: async (request, handler) => {
          const call = await budget.beforeCall([request.systemMessage, ...request.messages]);
          try {
            const message = await handler({ ...request, model: call.model });
            await budget.afterCall(call.callId, message);
            return message;
          } catch (error) {
            budget.onCallError(error);
            throw error;
          }
        },
        wrapToolCall: async (request, handler) => {
          budget.beforeToolCall();
          return handler(request);
        },
      }),
    ],
  });
}
