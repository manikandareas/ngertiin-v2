import {
  Inject,
  Injectable,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from "@nestjs/common";
import { adaptiveGenerationJobSchema, type AdaptiveGenerationJob } from "@ngertiin/contracts/jobs";
import { QUEUE_NAMES } from "@ngertiin/shared";
import { Worker as BullWorker, type Job, UnrecoverableError } from "bullmq";
import { AiService } from "../ai/ai.service.js";
import { InfrastructureService } from "../infrastructure/infrastructure.service.js";
import { nodeActivitiesSchemaFor, type NodeActivities } from "../modules/modules.schemas.js";
import { AdaptiveService } from "./adaptive.service.js";
import { adaptivePlanSchema } from "./adaptive.schemas.js";

@Injectable()
export class AdaptiveProcessor implements OnApplicationBootstrap, OnApplicationShutdown {
  private worker?: BullWorker<AdaptiveGenerationJob>;
  constructor(
    @Inject(InfrastructureService) private readonly infrastructure: InfrastructureService,
    @Inject(AdaptiveService) private readonly adaptive: AdaptiveService,
    @Inject(AiService) private readonly ai: AiService,
  ) {}
  onApplicationBootstrap(): void {
    this.worker = new BullWorker(QUEUE_NAMES.adaptiveGeneration, (job) => this.process(job), {
      connection: this.infrastructure.redis,
      concurrency: 1,
    });
    this.worker.on("error", (error) =>
      console.error(
        JSON.stringify({ level: "error", event: "adaptive.worker_error", errorType: error.name }),
      ),
    );
  }
  async onApplicationShutdown(): Promise<void> {
    await this.worker?.close();
  }

  private async process(job: Job<AdaptiveGenerationJob>): Promise<void> {
    const payload = adaptiveGenerationJobSchema.parse(job.data);
    await this.adaptive.withRunLock(payload.generationRunId, async () => {
      try {
        const context = await this.adaptive.start(payload);
        if (!context) return;
        await this.adaptive.begin(payload.generationRunId, "analyze_weak_concepts");
        await this.adaptive.complete(payload.generationRunId, "analyze_weak_concepts", {
          conceptCount: context.concepts.length,
        });
        await this.adaptive.begin(payload.generationRunId, "plan_remediation");
        const plan = await this.ai.generateObject({
          schema: adaptivePlanSchema,
          schemaName: "adaptive_plan",
          operation: "plan_remediation",
          prompt: [
            "Create a focused remediation plan of one to three nodes.",
            "Use only the supplied target concept keys. Do not create or modify core nodes.",
            "Allowed node types: review, practice, flashcard, remedial_quiz.",
            `TARGET CONCEPTS:\n${JSON.stringify(context.concepts)}`,
            `RELEVANT CORE CONTENT:\n${JSON.stringify(context.coreContent)}`,
          ].join("\n\n"),
        });
        await this.adaptive.complete(payload.generationRunId, "plan_remediation", {
          nodeCount: plan.nodes.length,
        });
        await this.adaptive.begin(payload.generationRunId, "generate_adaptive_activities");
        const generated: NodeActivities[] = [];
        for (const node of plan.nodes) {
          const schemaType =
            node.type === "flashcard" ? "flashcard" : node.type === "review" ? "lesson" : "quiz";
          generated.push(
            await this.ai.generateObject({
              schema: nodeActivitiesSchemaFor(schemaType),
              schemaName: "adaptive_node_activities",
              operation: "generate_adaptive_activities",
              prompt: [
                "Generate focused remediation activities for this adaptive node.",
                "Use only supplied concept keys and existing core content. Put answer keys only in evaluationConfig.",
                `NODE:\n${JSON.stringify(node)}`,
                `TARGET CONCEPTS:\n${JSON.stringify(context.concepts)}`,
                `RELEVANT CORE CONTENT:\n${JSON.stringify(context.coreContent)}`,
              ].join("\n\n"),
            }),
          );
        }
        await this.adaptive.complete(payload.generationRunId, "generate_adaptive_activities", {
          nodeCount: generated.length,
        });
        await this.adaptive.begin(payload.generationRunId, "validate_adaptive_content");
        await this.adaptive.finalize(payload, context, plan, generated);
      } catch (error) {
        if (job.attemptsMade + 1 < (job.opts.attempts ?? 1)) throw error;
        await this.adaptive.fail(payload);
        throw new UnrecoverableError("GENERATION_FAILED");
      }
    });
  }
}
