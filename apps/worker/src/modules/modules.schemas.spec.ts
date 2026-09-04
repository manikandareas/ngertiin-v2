import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { z } from "zod";
import {
  chunkMapOutputSchema,
  conceptMapSchema,
  curriculumPlanSchema,
  materialAnalysisSchema,
  nodeActivitiesSchemaFor,
} from "./modules.schemas.js";

type JsonSchema = Record<string, unknown>;

function isJsonSchema(value: unknown): value is JsonSchema {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertFieldsDescribed(schema: JsonSchema, path = "$"): void {
  if (isJsonSchema(schema.properties)) {
    for (const [field, fieldSchema] of Object.entries(schema.properties)) {
      assert.ok(isJsonSchema(fieldSchema), `${path}.${field} must have a JSON schema`);
      assert.equal(
        typeof fieldSchema.description,
        "string",
        `${path}.${field} must have a description`,
      );
      assertFieldsDescribed(fieldSchema, `${path}.${field}`);
    }
  }

  if (isJsonSchema(schema.items)) assertFieldsDescribed(schema.items, `${path}[]`);
  for (const unionKey of ["anyOf", "oneOf", "allOf"] as const) {
    const variants = schema[unionKey];
    if (!Array.isArray(variants)) continue;
    variants.forEach((variant, index) => {
      if (isJsonSchema(variant)) assertFieldsDescribed(variant, `${path}.${unionKey}[${index}]`);
    });
  }
}

function assertAllObjectFieldsRequired(schema: JsonSchema, path = "$"): void {
  if (isJsonSchema(schema.properties)) {
    const required = new Set(Array.isArray(schema.required) ? schema.required : []);
    for (const [field, fieldSchema] of Object.entries(schema.properties)) {
      assert.ok(required.has(field), `${path}.${field} must be required for strict output`);
      if (isJsonSchema(fieldSchema)) {
        assertAllObjectFieldsRequired(fieldSchema, `${path}.${field}`);
      }
    }
  }

  if (isJsonSchema(schema.items)) assertAllObjectFieldsRequired(schema.items, `${path}[]`);
  for (const unionKey of ["anyOf", "oneOf", "allOf"] as const) {
    const variants = schema[unionKey];
    if (!Array.isArray(variants)) continue;
    variants.forEach((variant, index) => {
      if (isJsonSchema(variant)) {
        assertAllObjectFieldsRequired(variant, `${path}.${unionKey}[${index}]`);
      }
    });
  }
}

describe("Module structured-output schemas", () => {
  test("describes every generated object field", () => {
    const schemas = [
      chunkMapOutputSchema,
      materialAnalysisSchema,
      conceptMapSchema,
      curriculumPlanSchema,
      nodeActivitiesSchemaFor("lesson"),
      nodeActivitiesSchemaFor("flashcard"),
      nodeActivitiesSchemaFor("quiz"),
      nodeActivitiesSchemaFor("checkpoint"),
    ];

    for (const schema of schemas) {
      assertFieldsDescribed(z.toJSONSchema(schema) as JsonSchema);
    }
  });

  test("requires every object field for strict structured output", () => {
    const schemas = [
      chunkMapOutputSchema,
      materialAnalysisSchema,
      conceptMapSchema,
      curriculumPlanSchema,
      nodeActivitiesSchemaFor("lesson"),
      nodeActivitiesSchemaFor("flashcard"),
      nodeActivitiesSchemaFor("quiz"),
      nodeActivitiesSchemaFor("checkpoint"),
    ];

    for (const schema of schemas) {
      assertAllObjectFieldsRequired(z.toJSONSchema(schema) as JsonSchema);
    }
  });

  test("does not emit unsupported oneOf branches", () => {
    const schema = z.toJSONSchema(nodeActivitiesSchemaFor("lesson"));

    assert.doesNotMatch(JSON.stringify(schema), /"oneOf"/);
  });
});
