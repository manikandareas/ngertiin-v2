import type { ChatOpenAI } from "@langchain/openai";
import { createAgent } from "langchain";
import { learningPrompt } from "./prompts/learning.prompt.js";

export function createLearningAgent(model: ChatOpenAI) {
  return createAgent({ model, tools: [], systemPrompt: learningPrompt });
}
