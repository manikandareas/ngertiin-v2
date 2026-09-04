import {
  Inject,
  Injectable,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from "@nestjs/common";
import { type SourceProcessingJob, sourceProcessingJobSchema } from "@ngertiin/contracts/jobs";
import { QUEUE_NAMES } from "@ngertiin/shared";
import { type Job, UnrecoverableError, Worker as BullWorker } from "bullmq";
import { InfrastructureService } from "../infrastructure/infrastructure.service.js";
import { OcrService } from "../ocr/ocr.service.js";
import { ScraperService } from "../scraper/scraper.service.js";
import {
  mapSourceProcessingFailure,
  SourceProcessingFailure,
} from "./source-processing.failure.js";
import {
  type NormalizedSourceContent,
  SourceProcessingService,
} from "./source-processing.service.js";

@Injectable()
export class SourceProcessor implements OnApplicationBootstrap, OnApplicationShutdown {
  private worker?: BullWorker<SourceProcessingJob>;

  constructor(
    @Inject(InfrastructureService) private readonly infrastructure: InfrastructureService,
    @Inject(SourceProcessingService) private readonly processing: SourceProcessingService,
    @Inject(OcrService) private readonly ocr: OcrService,
    @Inject(ScraperService) private readonly scraper: ScraperService,
  ) {}

  onApplicationBootstrap(): void {
    this.worker = new BullWorker<SourceProcessingJob>(
      QUEUE_NAMES.sourceProcessing,
      async (job) => this.processJob(job),
      { connection: this.infrastructure.redis, concurrency: 2 },
    );
    this.worker.on("completed", (job) => {
      console.log(
        JSON.stringify({
          level: "log",
          event: "source_processing.job_completed",
          runId: job.data.processingRunId,
          jobId: job.id,
        }),
      );
    });
    this.worker.on("failed", (job, error) => {
      console.error(
        JSON.stringify({
          level: "error",
          event: "source_processing.job_attempt_failed",
          runId: job?.data.processingRunId,
          jobId: job?.id,
          attempt: job?.attemptsMade,
          errorType: error.name,
        }),
      );
    });
    this.worker.on("error", (error) => {
      console.error(
        JSON.stringify({
          level: "error",
          event: "source_processing.worker_error",
          errorType: error.name,
        }),
      );
    });
  }

  async onApplicationShutdown(): Promise<void> {
    await this.worker?.close();
  }

  private async processJob(job: Job<SourceProcessingJob>): Promise<void> {
    const payload = sourceProcessingJobSchema.parse(job.data);
    await this.processing.withRunLock(payload.processingRunId, async () => {
      try {
        const source = await this.processing.startRun(payload);
        if (!source) return;

        let contents: NormalizedSourceContent[];
        let metadata: Record<string, unknown>;
        if (source.type === "pdf") {
          if (!source.storageKey) {
            throw new SourceProcessingFailure("SOURCE_INVALID_PDF", false);
          }
          let binary: Uint8Array;
          try {
            binary = await this.infrastructure.storage.get(source.storageKey);
          } catch (error) {
            throw new SourceProcessingFailure("SOURCE_PROCESSING_FAILED", true, error);
          }
          const pages = await this.ocr.extractPdf(binary);
          if (!pages.some((page) => page.markdown.length > 0)) {
            throw new SourceProcessingFailure("SOURCE_TEXT_NOT_EXTRACTABLE", false);
          }
          contents = pages.map((page, index) => ({
            type: "page",
            position: index + 1,
            pageNumber: page.pageNumber,
            content: page.markdown,
          }));
          metadata = { page_count: pages.length };
        } else {
          if (!source.originalUrl) {
            throw new SourceProcessingFailure("SOURCE_UNSUPPORTED_MEDIA_TYPE", false);
          }
          const result = await this.scraper.scrapeMainContent(source.originalUrl);
          if (result.markdown.length === 0) {
            throw new SourceProcessingFailure("SOURCE_TEXT_NOT_EXTRACTABLE", false);
          }
          contents = [{ type: "content", position: 1, pageNumber: null, content: result.markdown }];
          metadata = {};
        }

        await this.processing.completeRun(payload, contents, metadata);
      } catch (error) {
        const failure = mapSourceProcessingFailure(error);
        const attempts = job.opts.attempts ?? 1;
        if (failure.retryable && job.attemptsMade + 1 < attempts) throw failure;

        await this.processing.failRun(payload, failure.toPublicFailure());
        console.error(
          JSON.stringify({
            level: "error",
            event: "source_processing.run_failed",
            runId: payload.processingRunId,
            jobId: job.id,
            failureCode: failure.code,
            retryable: failure.retryable,
          }),
        );
        throw new UnrecoverableError(failure.code);
      }
    });
  }
}
