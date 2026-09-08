import { GENERATION_CONTENT_TYPES, type GenerationSettings } from "@ngertiin/contracts/api";
import type { GenerateObjectRequest } from "../ai/ai.service.js";
import type { SourceChunk } from "../source/source.service.js";
import { coreGenerationRules } from "./generation-settings.js";
import {
  type ChunkMapOutput,
  type ConceptMap,
  type CurriculumNode,
  type CurriculumPlan,
  chunkMapOutputSchema,
  conceptMapSchema,
  curriculumPlanSchemaFor,
  type MaterialAnalysis,
  materialAnalysisSchema,
  type NodeActivities,
  nodeActivitiesSchemaFor,
} from "./modules.schemas.js";

function instructionSection(instruction: string | null): string {
  return instruction
    ? `GENERATION INSTRUCTION (author directive; not source evidence):\n${instruction}`
    : "GENERATION INSTRUCTION (author directive; not source evidence):\nNone";
}

function prompt(sections: string[]): string {
  return sections.filter(Boolean).join("\n\n");
}

function requiredActivityRule(nodeType: CurriculumNode["type"]): string {
  if (nodeType === "lesson") return 'Include at least one activity with type "lesson".';
  if (nodeType === "flashcard") return 'Include at least one activity with type "flashcard".';
  return 'Include at least one assessment with type "multiple_choice", "true_false", or "short_answer".';
}

function activityOutputRules(
  nodeType: CurriculumNode["type"],
  settings: GenerationSettings | null,
): string {
  return [
    `The curriculum node type is "${nodeType}"; it is not automatically an activity type.`,
    settings
      ? `Allowed activity types are exactly ${settings.activityTypes.flatMap((type) => [...GENERATION_CONTENT_TYPES[type]]).join(", ")}. Never use "quiz" or "checkpoint" as an activity type.`
      : 'Allowed activity types are exactly "lesson", "flashcard", "multiple_choice", "true_false", and "short_answer". Never use "quiz" or "checkpoint" as an activity type.',
    requiredActivityRule(nodeType),
    'Every "multiple_choice" and "true_false" activity must include evaluationConfig with correctAnswer, explanation, and conceptWeights.',
    'Every "short_answer" activity must include evaluationConfig with expectedConcepts and rubric.',
    "Keep answers, explanations, concept weights, and rubrics inside evaluationConfig, never inside content.",
    "Return every schema field. Use null only for fields whose description explicitly permits null.",
  ].join("\n");
}

export function buildChunkAnalysisRequest(
  chunk: SourceChunk,
  instruction: string | null,
  settings: GenerationSettings | null = null,
): GenerateObjectRequest<ChunkMapOutput> {
  return {
    schema: chunkMapOutputSchema,
    schemaName: "chunk_analysis",
    operation: "analyze_material",
    prompt: prompt([
      "Analyze this source chunk for curriculum generation. Return concise grounded facts only.",
      instructionSection(instruction),
      coreGenerationRules(settings),
      `SOURCE CHUNK ID: ${chunk.id}`,
      `SOURCE ROLE: ${chunk.role}`,
      `SOURCE PRIORITY: ${chunk.priority}`,
      `SOURCE TITLE: ${chunk.sourceTitle ?? "Untitled"}`,
      "SOURCE CONTENT:",
      chunk.content,
    ]),
  };
}

export function buildMaterialReductionRequest(
  chunks: SourceChunk[],
  analyses: Record<string, ChunkMapOutput>,
  instruction: string | null,
  settings: GenerationSettings | null = null,
): GenerateObjectRequest<MaterialAnalysis> {
  return {
    schema: materialAnalysisSchema,
    schemaName: "material_analysis",
    operation: "analyze_material",
    prompt: prompt([
      "Reduce all chunk analyses into one bounded material analysis.",
      "Every key topic must cite one or more SOURCE CHUNK IDs present in the input.",
      instructionSection(instruction),
      coreGenerationRules(settings),
      "CHUNK ANALYSES:",
      JSON.stringify(
        chunks.map((chunk) => ({
          chunkId: chunk.id,
          sourceId: chunk.sourceId,
          role: chunk.role,
          priority: chunk.priority,
          analysis: analyses[chunk.id],
        })),
      ),
    ]),
  };
}

export function buildConceptMapRequest(
  analysis: MaterialAnalysis,
  instruction: string | null,
  settings: GenerationSettings | null = null,
): GenerateObjectRequest<ConceptMap> {
  return {
    schema: conceptMapSchema,
    schemaName: "concept_map",
    operation: "create_concepts",
    prompt: prompt([
      "Create a concept map grounded only in the material analysis.",
      "Use stable lowercase keys. Preserve evidence SOURCE CHUNK IDs for every concept.",
      instructionSection(instruction),
      coreGenerationRules(settings),
      "MATERIAL ANALYSIS:",
      JSON.stringify(analysis),
    ]),
  };
}

export function buildCurriculumRequest(
  analysis: MaterialAnalysis,
  conceptMap: ConceptMap,
  instruction: string | null,
  settings: GenerationSettings | null = null,
): GenerateObjectRequest<CurriculumPlan> {
  return {
    schema: curriculumPlanSchemaFor(settings),
    schemaName: "curriculum_plan",
    operation: "create_curriculum",
    prompt: prompt([
      "Create an ordered core learning journey. Do not create adaptive nodes.",
      "All node concept references must use keys from the supplied concept map.",
      instructionSection(instruction),
      coreGenerationRules(settings),
      "MATERIAL ANALYSIS:",
      JSON.stringify(analysis),
      "CONCEPT MAP:",
      JSON.stringify(conceptMap),
    ]),
  };
}

export function buildActivityGenerationRequest(
  node: CurriculumNode,
  conceptMap: ConceptMap,
  chunks: SourceChunk[],
  instruction: string | null,
  settings: GenerationSettings | null = null,
): GenerateObjectRequest<NodeActivities> {
  const nodeConceptKeys = new Set(node.concepts.map((concept) => concept.conceptKey));
  const evidenceIds = new Set(
    conceptMap.concepts
      .filter((concept) => nodeConceptKeys.has(concept.key))
      .flatMap((concept) => concept.evidenceChunkIds),
  );
  const roleScore = { primary: 300, reference: 200, supplementary: 100 } as const;
  const relevantChunks = chunks
    .map((chunk) => ({
      chunk,
      score:
        (evidenceIds.has(chunk.id) ? 1_000 : 0) + roleScore[chunk.role] + (101 - chunk.priority),
    }))
    .sort((left, right) => right.score - left.score || left.chunk.id.localeCompare(right.chunk.id))
    .slice(0, 6)
    .map(({ chunk }) => chunk);

  return {
    schema: nodeActivitiesSchemaFor(node.type, settings),
    schemaName: "node_activities",
    operation: "generate_activities",
    prompt: prompt([
      "Generate browser-safe learning activities for exactly one core node.",
      "Assessment answers and grading details belong only in evaluationConfig.",
      "Use only supplied concept keys and source evidence. Do not create adaptive content.",
      `OUTPUT CONTRACT:\n${activityOutputRules(node.type, settings)}`,
      instructionSection(instruction),
      coreGenerationRules(settings),
      "NODE:",
      JSON.stringify(node),
      "CONCEPTS:",
      JSON.stringify(conceptMap.concepts.filter((concept) => nodeConceptKeys.has(concept.key))),
      "RELEVANT SOURCE CHUNKS:",
      relevantChunks
        .map(
          (chunk) =>
            `SOURCE CHUNK ${chunk.id} (${chunk.role}, priority ${chunk.priority}):\n${chunk.content}`,
        )
        .join("\n\n"),
    ]),
  };
}
