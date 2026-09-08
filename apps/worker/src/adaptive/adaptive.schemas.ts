import { z } from "zod";

const key = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .regex(/^[a-z0-9][a-z0-9_-]*$/);

export const adaptivePlanSchema = z
  .object({
    reasonSummary: z.string().trim().min(1).max(500),
    nodes: z
      .array(
        z.object({
          type: z.enum(["review", "practice", "flashcard", "remedial_quiz"]),
          title: z.string().trim().min(1).max(200),
          description: z.string().trim().min(1).max(1_000).nullable(),
          targetConceptKeys: z.array(key).min(1).max(20),
        }),
      )
      .min(1)
      .max(3),
  })
  .strict();

export type AdaptivePlan = z.infer<typeof adaptivePlanSchema>;

export const adaptiveCheckpointSchema = z
  .object({
    plan: adaptivePlanSchema,
    generated: z.array(z.unknown()).max(3),
  })
  .refine(({ plan, generated }) => generated.length <= plan.nodes.length, {
    message: "Checkpoint cannot contain more completed nodes than its plan.",
  });
