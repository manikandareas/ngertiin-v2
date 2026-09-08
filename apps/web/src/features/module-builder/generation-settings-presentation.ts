import { GENERATION_LENGTH_RANGES, type GenerationSettings } from "@ngertiin/contracts/api";

export const activityLabels = {
  lesson: "Materi",
  flashcard: "Flashcard",
  quiz: "Kuis",
} satisfies Record<GenerationSettings["activityTypes"][number], string>;
const lengthLabels = {
  auto: "Otomatis",
  short: "Singkat",
  medium: "Sedang",
  long: "Panjang",
} satisfies Record<GenerationSettings["length"], string>;
export function generationLengthLabel(length: GenerationSettings["length"]): string {
  const range = GENERATION_LENGTH_RANGES[length];
  return length === "auto" ? "Otomatis" : `${lengthLabels[length]} (${range.min}–${range.max})`;
}
