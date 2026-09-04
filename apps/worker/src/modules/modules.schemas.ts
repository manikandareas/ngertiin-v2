import { z } from "zod";

const shortTextSchema = z.string().trim().min(1).max(500);
const bodyTextSchema = z.string().trim().min(1).max(4_000);
const conceptKeySchema = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .regex(/^[a-z0-9][a-z0-9_-]*$/);
const conceptWeightSchema = z.number().min(0).max(1);

export const chunkMapOutputSchema = z
  .object({
    summary: z
      .string()
      .trim()
      .min(1)
      .max(1_200)
      .describe("Concise summary grounded only in the source chunk content."),
    topics: z
      .array(shortTextSchema.describe("Name of one main topic covered by the source chunk."))
      .min(1)
      .max(12)
      .describe("Main topics explicitly covered by the source chunk."),
    facts: z
      .array(
        z
          .string()
          .trim()
          .min(1)
          .max(240)
          .describe("One concrete fact supported by the source chunk."),
      )
      .max(12)
      .describe("Concrete facts supported directly by the source chunk."),
  })
  .describe("Grounded analysis of one source chunk for curriculum generation.");

export const materialAnalysisSchema = z
  .object({
    subject: shortTextSchema.describe("Primary subject represented by the analyzed material."),
    level: shortTextSchema
      .nullable()
      .describe(
        "Learner or academic level inferred from the material; use null when it cannot be identified.",
      ),
    summary: z
      .string()
      .trim()
      .min(1)
      .max(3_000)
      .describe("Integrated summary of the material across all analyzed source chunks."),
    estimatedComplexity: z
      .enum(["low", "medium", "high"])
      .describe("Overall conceptual complexity of the material."),
    keyTopics: z
      .array(
        z
          .object({
            key: conceptKeySchema.describe(
              "Stable lowercase identifier for the topic using letters, numbers, underscores, or hyphens.",
            ),
            title: shortTextSchema.describe("Human-readable title of the key topic."),
            description: bodyTextSchema.describe(
              "Grounded explanation of what the key topic covers.",
            ),
            importance: z
              .number()
              .min(0)
              .max(1)
              .describe("Relative importance of the topic from 0 to 1."),
            evidenceChunkIds: z
              .array(
                z
                  .string()
                  .min(1)
                  .max(100)
                  .describe("ID of a source chunk that supports this topic."),
              )
              .min(1)
              .max(12)
              .describe("Source chunk IDs providing evidence for this topic."),
          })
          .describe("One important topic identified in the material."),
      )
      .min(1)
      .max(30)
      .describe("Most important grounded topics found across the material."),
    constraints: z
      .array(
        shortTextSchema.describe(
          "One limitation, prerequisite, or author directive that constrains generation.",
        ),
      )
      .max(20)
      .describe("Constraints that subsequent curriculum generation must respect."),
  })
  .describe("Reduced analysis of all source chunks used to plan the module.");

export const conceptMapSchema = z
  .object({
    concepts: z
      .array(
        z
          .object({
            key: conceptKeySchema.describe(
              "Stable lowercase identifier for the concept using letters, numbers, underscores, or hyphens.",
            ),
            name: shortTextSchema.describe("Human-readable name of the concept."),
            description: bodyTextSchema
              .nullable()
              .describe("Grounded explanation of the concept; use null when none is needed."),
            importance: z
              .number()
              .min(0)
              .max(1)
              .describe("Relative importance of the concept from 0 to 1."),
            prerequisites: z
              .array(
                conceptKeySchema.describe(
                  "Key of another generated concept that should be learned first.",
                ),
              )
              .max(12)
              .describe("Concept keys that are prerequisites for this concept."),
            evidenceChunkIds: z
              .array(
                z
                  .string()
                  .min(1)
                  .max(100)
                  .describe("ID of a source chunk that supports this concept."),
              )
              .min(1)
              .max(12)
              .describe("Source chunk IDs providing evidence for this concept."),
          })
          .describe("One teachable concept grounded in the material."),
      )
      .min(1)
      .max(50)
      .describe("Concepts and prerequisite relationships that form the module concept map."),
  })
  .describe("Grounded concept map used to construct the curriculum.");

const curriculumNodeSchema = z
  .object({
    key: conceptKeySchema.describe(
      "Stable lowercase identifier for this curriculum node using letters, numbers, underscores, or hyphens.",
    ),
    type: z
      .enum(["lesson", "flashcard", "quiz", "checkpoint"])
      .describe("Learning experience type represented by this curriculum node."),
    title: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .describe("Concise learner-facing title of the curriculum node."),
    description: z
      .string()
      .trim()
      .min(1)
      .max(1_000)
      .nullable()
      .describe("Learner-facing description of the node's purpose; use null when none is needed."),
    concepts: z
      .array(
        z
          .object({
            conceptKey: conceptKeySchema.describe(
              "Key of a concept from the supplied concept map.",
            ),
            relation: z
              .enum(["teach", "review", "assess"])
              .describe("How this node uses the referenced concept."),
            weight: conceptWeightSchema.describe(
              "Relative contribution of the concept to this node from 0 to 1.",
            ),
          })
          .describe("Relationship between this node and one concept."),
      )
      .min(1)
      .max(20)
      .describe("Concepts taught, reviewed, or assessed by this node."),
  })
  .describe("One ordered learning node in the core curriculum.");

export const curriculumPlanSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .describe("Learner-facing title of the generated module."),
    description: z
      .string()
      .trim()
      .min(1)
      .max(2_000)
      .nullable()
      .describe("Learner-facing overview of the generated module; use null when none is needed."),
    difficulty: z
      .enum(["beginner", "intermediate", "advanced"])
      .describe("Overall difficulty level of the curriculum."),
    estimatedMinutes: z
      .number()
      .int()
      .min(1)
      .max(600)
      .nullable()
      .describe(
        "Estimated whole minutes needed to complete the module; use null when it cannot be estimated.",
      ),
    nodes: z
      .array(curriculumNodeSchema)
      .min(1)
      .max(20)
      .describe("Ordered core learning journey from introduction through assessment."),
  })
  .describe("Complete ordered curriculum plan for the generated module.");

const conceptWeightsSchema = z
  .array(
    z
      .object({
        conceptKey: conceptKeySchema.describe("Key of a concept from the supplied concept map."),
        weight: conceptWeightSchema.describe(
          "Contribution of the concept to evaluating this activity from 0 to 1.",
        ),
      })
      .describe("Evaluation weight assigned to one concept."),
  )
  .min(1)
  .max(20)
  .refine((weights) => weights.some((item) => item.weight > 0), {
    message: "Concept weights must have a positive total.",
  })
  .describe("Concept-level evaluation weights with at least one positive weight.");

const lessonActivitySchema = z
  .object({
    type: z.literal("lesson").describe("Activity discriminator; always lesson."),
    content: z
      .object({
        introduction: bodyTextSchema
          .nullable()
          .describe(
            "Opening that connects the lesson to the learner's context; use null when none is needed.",
          ),
        explanation: bodyTextSchema.describe(
          "Main grounded explanation that teaches the node's concepts.",
        ),
        keyPoints: z
          .array(shortTextSchema.describe("One essential takeaway from the lesson."))
          .min(1)
          .max(20)
          .describe("Essential takeaways the learner should retain."),
        examples: z
          .array(bodyTextSchema.describe("One grounded example illustrating the explanation."))
          .max(10)
          .nullable()
          .describe("Examples that clarify the taught concepts; use null when none are needed."),
        summary: bodyTextSchema
          .nullable()
          .describe("Closing recap of the lesson; use null when none is needed."),
      })
      .describe("Learner-visible instructional content for the lesson."),
  })
  .describe(
    "Lesson activity. It must contain exactly type and content; content must contain introduction, explanation, keyPoints, examples, and summary.",
  );

const flashcardActivitySchema = z
  .object({
    type: z.literal("flashcard").describe("Activity discriminator; always flashcard."),
    content: z
      .object({
        cards: z
          .array(
            z
              .object({
                front: shortTextSchema.describe(
                  "Prompt, term, or question shown on the front of the card.",
                ),
                back: bodyTextSchema.describe(
                  "Grounded answer or explanation shown on the back of the card.",
                ),
                conceptKey: conceptKeySchema.describe(
                  "Key of the concept reinforced by this card.",
                ),
              })
              .describe("One front-and-back study card tied to a concept."),
          )
          .min(1)
          .max(30)
          .describe("Study cards generated for this curriculum node."),
      })
      .describe("Learner-visible flashcard content."),
  })
  .describe(
    "Flashcard activity. It must contain exactly type and content, and content must contain cards.",
  );

const multipleChoiceActivitySchema = z
  .object({
    type: z.literal("multiple_choice").describe("Activity discriminator; always multiple_choice."),
    content: z
      .object({
        question: bodyTextSchema.describe("Grounded question presented to the learner."),
        options: z
          .array(shortTextSchema.describe("One possible answer shown to the learner."))
          .min(2)
          .max(8)
          .describe("Answer choices in learner-visible order."),
      })
      .describe("Learner-visible multiple-choice question and answer options."),
    evaluationConfig: z
      .object({
        correctAnswer: z
          .number()
          .int()
          .nonnegative()
          .describe("Zero-based index of the correct entry in content.options."),
        explanation: bodyTextSchema.describe(
          "Grounded explanation of why the selected answer is correct.",
        ),
        conceptWeights: conceptWeightsSchema.describe(
          "Concept weights used to score the learner's answer.",
        ),
      })
      .describe("Answer key and scoring metadata hidden from the learner until evaluation."),
  })
  .refine((activity) => activity.evaluationConfig.correctAnswer < activity.content.options.length, {
    message: "Correct answer must reference an available option.",
    path: ["evaluationConfig", "correctAnswer"],
  })
  .describe(
    "Multiple-choice assessment. It must contain exactly type, content, and the required evaluationConfig answer key.",
  );

const trueFalseActivitySchema = z
  .object({
    type: z.literal("true_false").describe("Activity discriminator; always true_false."),
    content: z
      .object({
        statement: bodyTextSchema.describe(
          "Grounded statement the learner must judge as true or false.",
        ),
      })
      .describe("Learner-visible true-or-false statement."),
    evaluationConfig: z
      .object({
        correctAnswer: z.boolean().describe("Whether the learner-visible statement is true."),
        explanation: bodyTextSchema.describe(
          "Grounded explanation of the statement's truth value.",
        ),
        conceptWeights: conceptWeightsSchema.describe(
          "Concept weights used to score the learner's answer.",
        ),
      })
      .describe("Answer key and scoring metadata hidden from the learner until evaluation."),
  })
  .describe(
    "True-or-false assessment. It must contain exactly type, content, and the required evaluationConfig answer key; never place commentary or the answer inside content.",
  );

const shortAnswerActivitySchema = z
  .object({
    type: z.literal("short_answer").describe("Activity discriminator; always short_answer."),
    content: z
      .object({
        prompt: bodyTextSchema.describe("Grounded open-ended prompt presented to the learner."),
      })
      .describe("Learner-visible short-answer prompt."),
    evaluationConfig: z
      .object({
        expectedConcepts: z
          .array(
            conceptKeySchema.describe(
              "Key of a concept expected in a satisfactory learner answer.",
            ),
          )
          .min(1)
          .max(20)
          .describe("Concept keys expected in a satisfactory answer."),
        rubric: z
          .array(
            z
              .object({
                criterion: shortTextSchema.describe(
                  "Observable criterion used to evaluate the learner's answer.",
                ),
                weight: conceptWeightSchema.describe(
                  "Relative contribution of this criterion to the score from 0 to 1.",
                ),
              })
              .describe("One weighted short-answer evaluation criterion."),
          )
          .min(1)
          .max(12)
          .refine((items) => items.some((item) => item.weight > 0), {
            message: "Rubric weights must have a positive total.",
          })
          .describe("Weighted rubric with at least one positive criterion weight."),
      })
      .describe("Expected concepts and rubric used to evaluate the learner's answer."),
  })
  .describe(
    "Short-answer assessment. It must contain exactly type, content, and the required evaluationConfig rubric.",
  );

const generatedActivitySchema = z
  .union([
    lessonActivitySchema,
    flashcardActivitySchema,
    multipleChoiceActivitySchema,
    trueFalseActivitySchema,
    shortAnswerActivitySchema,
  ])
  .describe(
    "One activity whose type is exactly lesson, flashcard, multiple_choice, true_false, or short_answer; quiz and checkpoint are curriculum node types and must never be used as activity types.",
  );

const nodeActivitiesSchema = z
  .object({
    activities: z
      .array(generatedActivitySchema)
      .min(1)
      .max(10)
      .describe(
        "One to ten complete activities. Every assessment activity must include evaluationConfig as a sibling of content.",
      ),
  })
  .describe("Generated activities for one curriculum node.");

function nodeActivityRequirement(nodeType: CurriculumNode["type"]): string {
  if (nodeType === "lesson") {
    return "For this lesson curriculum node, activities must include at least one activity with type lesson.";
  }
  if (nodeType === "flashcard") {
    return "For this flashcard curriculum node, activities must include at least one activity with type flashcard.";
  }
  return `For this ${nodeType} curriculum node, activities must include at least one assessment with type multiple_choice, true_false, or short_answer; do not use ${nodeType} as an activity type.`;
}

export function nodeActivitiesSchemaFor(nodeType: CurriculumNode["type"]) {
  return nodeActivitiesSchema
    .refine(
      (output) => {
        const types = new Set(output.activities.map((activity) => activity.type));
        if (nodeType === "lesson") return types.has("lesson");
        if (nodeType === "flashcard") return types.has("flashcard");
        return (["multiple_choice", "true_false", "short_answer"] as const).some((type) =>
          types.has(type),
        );
      },
      {
        message: `Activities must satisfy the ${nodeType} node.`,
        path: ["activities"],
      },
    )
    .describe(nodeActivityRequirement(nodeType));
}

export type ChunkMapOutput = z.infer<typeof chunkMapOutputSchema>;
export type MaterialAnalysis = z.infer<typeof materialAnalysisSchema>;
export type ConceptMap = z.infer<typeof conceptMapSchema>;
export type CurriculumNode = z.infer<typeof curriculumNodeSchema>;
export type CurriculumPlan = z.infer<typeof curriculumPlanSchema>;
export type NodeActivities = z.infer<typeof nodeActivitiesSchema>;
