import { z } from "zod";

export const MODULE_GENERATION_PHASES = [
  "preparing_sources",
  "understanding_material",
  "creating_concepts",
  "creating_journey",
  "generating_activities",
  "validating_content",
] as const;

export const MODULE_GENERATION_STEPS = [
  {
    name: "extract_sources",
    phase: MODULE_GENERATION_PHASES[0],
    startProgress: 0,
    completedProgress: 10,
  },
  {
    name: "analyze_material",
    phase: MODULE_GENERATION_PHASES[1],
    startProgress: 10,
    completedProgress: 30,
  },
  {
    name: "create_concepts",
    phase: MODULE_GENERATION_PHASES[2],
    startProgress: 30,
    completedProgress: 45,
  },
  {
    name: "create_curriculum",
    phase: MODULE_GENERATION_PHASES[3],
    startProgress: 45,
    completedProgress: 60,
  },
  {
    name: "generate_activities",
    phase: MODULE_GENERATION_PHASES[4],
    startProgress: 60,
    completedProgress: 90,
  },
  {
    name: "validate_module",
    phase: MODULE_GENERATION_PHASES[5],
    startProgress: 90,
    completedProgress: 100,
  },
] as const;

export type ModuleGenerationStep = (typeof MODULE_GENERATION_STEPS)[number]["name"];

export const moduleGenerationJobSchema = z
  .object({
    generationRunId: z.string().uuid(),
    moduleId: z.string().uuid(),
    generationRequestId: z.string().uuid(),
  })
  .strict();

export type ModuleGenerationJob = z.infer<typeof moduleGenerationJobSchema>;
