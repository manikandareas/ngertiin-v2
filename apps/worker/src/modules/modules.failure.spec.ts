import assert from "node:assert/strict";
import { test } from "node:test";
import { AiError } from "../ai/ai.error.js";
import { findModuleGenerationFailure } from "./modules.failure.js";

test("parallel failures preserve existing provider/output classification through wrappers", () => {
  for (const [category, code] of [
    ["provider_unavailable", "GENERATION_PROVIDER_UNAVAILABLE"],
    ["invalid_output", "GENERATION_INVALID_OUTPUT"],
  ] as const) {
    const error = new AggregateError([
      new Error("unclassified"),
      { cause: new AggregateError([new AiError(category, "generate_activities")]) },
    ]);
    const failure = findModuleGenerationFailure(error, "extract_sources");
    assert.equal(failure?.code, code);
    assert.equal(failure?.step, "generate_activities");
  }
});

test("unmapped and cyclic aggregate errors remain available for queue retries", () => {
  const error = new AggregateError([new Error("database unavailable")]);
  error.errors.push(error);
  assert.equal(findModuleGenerationFailure(error, "extract_sources"), undefined);
});
