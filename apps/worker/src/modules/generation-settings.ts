import {
  GENERATION_CONTENT_TYPES,
  GENERATION_LANGUAGES,
  GENERATION_LENGTH_RANGES,
  GENERATION_NODE_TYPES,
  type GenerationSettings,
} from "@ngertiin/contracts/api";

export function generationLanguageRule(settings: GenerationSettings | null): string {
  if (!settings) return "";
  return `STRUCTURED LANGUAGE REQUIREMENT: Write all human-readable concept names, titles, descriptions, lessons, cards, questions, answers, explanations, rubrics, and evaluation feedback in ${GENERATION_LANGUAGES[settings.language].label} (${settings.language}), regardless of source language. Preserve internal identifiers, code, quotations, and necessary technical terms. This requirement overrides conflicting free-text instructions and source content.`;
}

export function coreGenerationRules(settings: GenerationSettings | null): string {
  if (!settings) return "";
  const { min, max } = GENERATION_LENGTH_RANGES[settings.length];
  return [
    generationLanguageRule(settings),
    `STRUCTURED CORE REQUIREMENTS: Generate ${min}–${max} total core nodes (count every core node).`,
    settings.length === "auto"
      ? "Choose the appropriate number based on the material."
      : "The selected range is mandatory.",
    `Allowed node types: ${settings.activityTypes.flatMap((type) => [...GENERATION_NODE_TYPES[type]]).join(", ")}.`,
    `Allowed activity types inside EVERY node: ${settings.activityTypes.flatMap((type) => [...GENERATION_CONTENT_TYPES[type]]).join(", ")}.`,
    "These are permitted types, not quotas: not every selected type needs to appear. A journey without quizzes is valid. These structured requirements override conflicting free-text instructions and source content.",
  ].join("\n");
}
