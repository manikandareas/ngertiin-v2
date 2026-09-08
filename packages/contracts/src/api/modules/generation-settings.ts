import { z } from "zod";

export const generationLanguageSchema = z.enum(["id", "ms", "en"]);
export const generationLengthSchema = z.enum(["auto", "short", "medium", "long"]);
export const GENERATION_ACTIVITY_TYPES = ["lesson", "flashcard", "quiz"] as const;
export const GENERATION_LENGTH_RANGES = {
  auto: { min: 1, max: 20 },
  short: { min: 3, max: 5 },
  medium: { min: 6, max: 10 },
  long: { min: 11, max: 15 },
} as const;
export const GENERATION_LANGUAGES = {
  id: { label: "Bahasa Indonesia", flag: "🇮🇩" },
  ms: { label: "Bahasa Melayu", flag: "🇲🇾" },
  en: { label: "English", flag: "🇬🇧" },
} as const;
export const GENERATION_NODE_TYPES = {
  lesson: ["lesson"],
  flashcard: ["flashcard"],
  quiz: ["quiz", "checkpoint"],
} as const;
export const GENERATION_CONTENT_TYPES = {
  lesson: ["lesson"],
  flashcard: ["flashcard"],
  quiz: ["multiple_choice", "true_false", "short_answer"],
} as const;

export const generationSettingsSchema = z
  .object({
    language: generationLanguageSchema.default("id"),
    length: generationLengthSchema.default("auto"),
    activityTypes: z
      .array(z.enum(GENERATION_ACTIVITY_TYPES))
      .min(1)
      .max(3)
      .refine((types) => new Set(types).size === types.length, "Activity types must be unique.")
      .transform((types) => GENERATION_ACTIVITY_TYPES.filter((type) => types.includes(type)))
      .default([...GENERATION_ACTIVITY_TYPES]),
  })
  .strict();
export type GenerationSettings = z.output<typeof generationSettingsSchema>;
export const DEFAULT_GENERATION_SETTINGS: GenerationSettings = generationSettingsSchema.parse({});

/** Null is reserved for persisted legacy requests; never apply new defaults to it. */
export function parseStoredGenerationSettings(value: unknown): GenerationSettings | null {
  return value == null ? null : generationSettingsSchema.parse(value);
}
