import { z } from "zod";

export const languageSchema = z.enum(["id", "ms", "en"]);

export const LANGUAGE_OPTIONS = {
  id: { label: "Bahasa Indonesia", flag: "🇮🇩" },
  ms: { label: "Bahasa Melayu", flag: "🇲🇾" },
  en: { label: "English", flag: "🇬🇧" },
} as const satisfies Record<z.infer<typeof languageSchema>, { label: string; flag: string }>;
