import type { AIMessage, BaseMessage, SystemMessage } from "@langchain/core/messages";
import type { StructuredToolInterface } from "@langchain/core/tools";
import type { ChatOpenAI } from "@langchain/openai";
import { createAgent, createMiddleware } from "langchain";
import { isAttachmentRejection } from "./chat-multimodal.js";
import { learningPrompt } from "./prompts/learning.prompt.js";

export type ExecutionBudget = {
  beforeCall(
    messages: BaseMessage[],
  ): Promise<{ callId: string; model: ChatOpenAI; systemMessage?: SystemMessage }>;
  afterCall(callId: string, message: AIMessage): Promise<void>;
  beforeToolCall(): void;
  canFallback(): boolean;
  rejectedCall(callId: string): void;
  onCallError(error: unknown): void;
};

export function createLearningAgent(
  model: ChatOpenAI,
  budget: ExecutionBudget,
  tools: StructuredToolInterface[] = [],
  fallback?: (messages: BaseMessage[]) => Promise<BaseMessage[]>,
) {
  let fallbackUsed = false;
  return createAgent({
    model,
    tools,
    systemPrompt: learningPrompt,
    middleware: [
      createMiddleware({
        name: "LearningRunBudget",
        wrapModelCall: async (request, handler) => {
          if (fallbackUsed && fallback)
            request = { ...request, messages: await fallback(request.messages) };
          const call = await budget.beforeCall([request.systemMessage, ...request.messages]);
          try {
            const message = await handler({
              ...request,
              model: call.model,
              systemMessage: call.systemMessage ?? request.systemMessage,
            });
            await budget.afterCall(call.callId, message);
            return message;
          } catch (error) {
            if (!fallbackUsed && fallback && budget.canFallback() && isAttachmentRejection(error)) {
              fallbackUsed = true;
              try {
                const messages = await fallback(request.messages);
                budget.rejectedCall(call.callId);
                const retry = await budget.beforeCall([request.systemMessage, ...messages]);
                const message = await handler({
                  ...request,
                  messages,
                  model: retry.model,
                  systemMessage: retry.systemMessage ?? request.systemMessage,
                });
                await budget.afterCall(retry.callId, message);
                return message;
              } catch (fallbackError) {
                budget.onCallError(fallbackError);
                throw fallbackError;
              }
            }
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
