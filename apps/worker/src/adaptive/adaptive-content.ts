import { AiError } from "../ai/ai.error.js";
import {
  checkpointActivitiesSchemaFor,
  type GeneratedNodeActivities,
  type NodeActivities,
  nodeActivitiesSchemaFor,
} from "../modules/modules.schemas.js";
import type { AdaptivePlan } from "./adaptive.schemas.js";

export class AdaptiveContentError extends Error {
  constructor(
    message: string,
    readonly nodeIndex?: number,
  ) {
    super(message);
    this.name = "AdaptiveContentError";
  }
}

export function validateAdaptivePlan(plan: AdaptivePlan, conceptKeys: string[]): void {
  const allowed = new Set(conceptKeys);
  if (plan.nodes.some((node) => node.targetConceptKeys.some((key) => !allowed.has(key)))) {
    throw new AdaptiveContentError("Adaptive plan references an unrelated concept.");
  }
  if (
    plan.nodes.some(
      (node) => new Set(node.targetConceptKeys).size !== node.targetConceptKeys.length,
    )
  ) {
    throw new AdaptiveContentError("Adaptive plan contains duplicate concept references.");
  }
}

export function adaptiveNodeSchemaType(
  node: AdaptivePlan["nodes"][number],
): "flashcard" | "lesson" | "quiz" {
  switch (node.type) {
    case "flashcard":
      return "flashcard";
    case "review":
      return "lesson";
    default:
      return "quiz";
  }
}

export function parseAdaptiveActivities(
  node: AdaptivePlan["nodes"][number],
  value: unknown,
  nodeIndex: number,
): NodeActivities {
  const parsed = checkpointActivitiesSchemaFor(adaptiveNodeSchemaType(node)).safeParse(value);
  if (!parsed.success) {
    throw new AdaptiveContentError("Adaptive activities do not match the node schema.", nodeIndex);
  }
  validateAdaptiveReferences(node, parsed.data, nodeIndex);
  return parsed.data;
}

export function parseGeneratedAdaptiveActivities(
  node: AdaptivePlan["nodes"][number],
  value: unknown,
  nodeIndex: number,
): GeneratedNodeActivities {
  const parsed = nodeActivitiesSchemaFor(adaptiveNodeSchemaType(node)).safeParse(value);
  if (!parsed.success)
    throw new AdaptiveContentError(
      "Generated adaptive activities do not match the node schema.",
      nodeIndex,
    );
  validateAdaptiveReferences(node, parsed.data, nodeIndex);
  return parsed.data;
}

function validateAdaptiveReferences(
  node: AdaptivePlan["nodes"][number],
  output: NodeActivities | GeneratedNodeActivities,
  nodeIndex: number,
): void {
  const allowed = new Set(node.targetConceptKeys);
  for (const activity of output.activities) {
    let references: string[] = [];
    switch (activity.type) {
      case "flashcard":
        references = activity.content.cards.map((card) => card.conceptKey);
        break;
      case "multiple_choice":
      case "true_false":
        references = activity.evaluationConfig.conceptWeights.map((weight) => weight.conceptKey);
        break;
      case "short_answer":
        references = activity.evaluationConfig.expectedConcepts;
        break;
    }
    if (references.some((key) => !allowed.has(key))) {
      throw new AdaptiveContentError(
        "Adaptive activity references an unrelated concept.",
        nodeIndex,
      );
    }
  }
}

export function adaptiveFailure(error: unknown) {
  if (
    error instanceof AdaptiveContentError ||
    (error instanceof AiError && error.category === "invalid_output")
  ) {
    return {
      code: "GENERATION_INVALID_OUTPUT" as const,
      message: "Adaptive content did not pass validation.",
      retryable: true,
    };
  }
  if (error instanceof AiError && error.category === "provider_unavailable") {
    return {
      code: "GENERATION_PROVIDER_UNAVAILABLE" as const,
      message: "The AI provider is temporarily unavailable.",
      retryable: true,
    };
  }
  return {
    code: "GENERATION_FAILED" as const,
    message: "Adaptive content generation could not be completed.",
    retryable: false,
  };
}

// Error messages from SQL drivers and providers may contain prompts, parameters, or credentials.
export function adaptiveErrorDetails(error: unknown) {
  const causes: unknown[] = [];
  let current = error;
  while (current instanceof Error && !causes.includes(current) && causes.length < 5) {
    causes.push(current);
    current = current.cause;
  }
  const safeToken = (value: unknown) =>
    typeof value === "string" && /^[A-Za-z0-9_.:-]{1,100}$/.test(value) ? value : undefined;
  return {
    errorType: error instanceof Error ? (safeToken(error.name) ?? "Error") : "UnknownError",
    errorMessage:
      error instanceof AdaptiveContentError || error instanceof AiError
        ? error.message
        : adaptiveFailure(error).message,
    nodeIndex: error instanceof AdaptiveContentError ? error.nodeIndex : undefined,
    causes: causes.map((cause) => {
      const value = cause as Error & { code?: unknown };
      return { errorType: safeToken(value.name), code: safeToken(value.code) };
    }),
    stack:
      error instanceof Error
        ? error.stack
            ?.split("\n")
            .filter((line) => /^\s+at /.test(line))
            .slice(0, 6)
            .map((line) => line.replace(/\/Users\/[^/]+/g, "/Users/<redacted>"))
        : undefined,
  };
}
