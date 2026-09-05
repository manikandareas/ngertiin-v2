import {
  Inject,
  Injectable,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from "@nestjs/common";
import { type ModuleGenerationJob, moduleGenerationJobSchema } from "@ngertiin/contracts/jobs";
import { QUEUE_NAMES } from "@ngertiin/shared";
import { Worker as BullWorker, type Job, UnrecoverableError } from "bullmq";
import { InfrastructureService } from "../infrastructure/infrastructure.service.js";
import { SourceService } from "../source/source.service.js";
import { findModuleGenerationFailure, ModuleGenerationFailure } from "./modules.failure.js";
import { ModulesService } from "./modules.service.js";
import { ModulesWorkflow } from "./modules.workflow.js";

@Injectable()
export class ModulesProcessor implements OnApplicationBootstrap, OnApplicationShutdown {
  private worker?: BullWorker<ModuleGenerationJob>;

  constructor(
    @Inject(InfrastructureService) private readonly infrastructure: InfrastructureService,
    @Inject(ModulesService) private readonly modules: ModulesService,
    @Inject(SourceService) private readonly sources: SourceService,
    @Inject(ModulesWorkflow) private readonly workflow: ModulesWorkflow,
  ) {}

  onApplicationBootstrap(): void {
    this.worker = new BullWorker<ModuleGenerationJob>(
      QUEUE_NAMES.moduleGeneration,
      async (job) => this.processJob(job),
      { connection: this.infrastructure.redis, concurrency: 1 },
    );
    this.worker.on("completed", (job) => {
      console.log(
        JSON.stringify({
          level: "log",
          event: "generation.job_completed",
          runId: job.data.generationRunId,
          moduleId: job.data.moduleId,
          jobId: job.id,
          attemptNumber: job.attemptsMade,
          latencyMs:
            job.processedOn && job.finishedOn
              ? Math.max(0, job.finishedOn - job.processedOn)
              : null,
          validationOutcome: "passed",
        }),
      );
    });
    this.worker.on("failed", (job, error) => {
      console.error(
        JSON.stringify({
          level: "error",
          event: "generation.job_attempt_failed",
          runId: job?.data.generationRunId,
          moduleId: job?.data.moduleId,
          jobId: job?.id,
          attemptNumber: job?.attemptsMade,
          latencyMs:
            job?.processedOn && job.finishedOn
              ? Math.max(0, job.finishedOn - job.processedOn)
              : null,
          failureCategory: error.name === "UnrecoverableError" ? "terminal" : "retryable",
        }),
      );
    });
    this.worker.on("error", (error) => {
      console.error(
        JSON.stringify({
          level: "error",
          event: "generation.worker_error",
          errorType: error.name,
        }),
      );
    });
  }

  async onApplicationShutdown(): Promise<void> {
    await this.worker?.close();
  }

  private async processJob(job: Job<ModuleGenerationJob>): Promise<void> {
    const payload = moduleGenerationJobSchema.parse(job.data);
    console.log(
      JSON.stringify({
        level: "log",
        event: "generation.job_started",
        runId: payload.generationRunId,
        moduleId: payload.moduleId,
        jobId: job.id,
        attemptNumber: job.attemptsMade + 1,
      }),
    );
    await this.modules.withRunLock(payload.generationRunId, async () => {
      try {
        const run = await this.modules.startRun(payload);
        if (!run) return;
        const chunks = await this.sources.loadModuleGenerationChunks({
          generationRequestId: payload.generationRequestId,
          userId: run.userId,
        });
        await this.workflow.run(payload, { instruction: run.instruction, chunks });
      } catch (error) {
        let failure = findModuleGenerationFailure(error, "extract_sources");
        if (!failure && job.attemptsMade + 1 < (job.opts.attempts ?? 1)) throw error;
        failure ??= new ModuleGenerationFailure(
          "GENERATION_FAILED",
          await this.modules.currentStep(payload.generationRunId),
          error,
        );
        await this.modules.failRun(payload, failure);
        console.error(
          JSON.stringify({
            level: "error",
            event: "generation.run_failed",
            runId: payload.generationRunId,
            jobId: job.id,
            step: failure.step,
            failureCode: failure.code,
          }),
        );
        throw new UnrecoverableError(failure.code);
      }
    });
  }
}
