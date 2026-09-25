export const QUEUE_NAMES = {
  knowledgeIndexing: "knowledge-indexing",
  sourceProcessing: "source-processing",
  moduleGeneration: "module-generation",
  adaptiveGeneration: "adaptive-generation",
  attemptEvaluation: "attempt-evaluation",
  speechGeneration: "speech-generation",
  practiceGeneration: "practice-generation",
  practiceEvaluation: "practice-evaluation",
} as const;

export * from "./assessment.js";
export * from "./attempt-finalizer.js";
export * from "./practice-xp.js";
export * from "./progression.js";
export * from "./public-url.js";
export * from "./speech.js";

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
