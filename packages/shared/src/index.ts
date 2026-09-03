export const QUEUE_NAMES = {
  sourceProcessing: "source-processing",
  moduleGeneration: "module-generation",
  adaptiveGeneration: "adaptive-generation",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
