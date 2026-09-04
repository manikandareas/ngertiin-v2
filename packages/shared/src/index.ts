export const QUEUE_NAMES = {
  sourceProcessing: "source-processing",
  moduleGeneration: "module-generation",
  adaptiveGeneration: "adaptive-generation",
  attemptEvaluation: "attempt-evaluation",
} as const;

export * from "./assessment.js";
export * from "./attempt-finalizer.js";
export * from "./progression.js";

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
