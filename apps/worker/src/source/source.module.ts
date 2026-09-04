import { Mistral } from "@mistralai/mistralai";
import { Module } from "@nestjs/common";
import type { WorkerEnvironment } from "@ngertiin/contracts/environment";
import Firecrawl from "firecrawl";
import { WORKER_ENV } from "../config.js";
import { InfrastructureModule } from "../infrastructure/infrastructure.module.js";
import { OCR_CLIENT, OcrService } from "../ocr/ocr.service.js";
import { SCRAPER_CLIENT, ScraperService } from "../scraper/scraper.service.js";
import { SourceProcessingService } from "./source-processing.service.js";
import { SourceProcessor } from "./source.processor.js";
import { SourceService } from "./source.service.js";

@Module({
  imports: [InfrastructureModule],
  providers: [
    {
      provide: OCR_CLIENT,
      inject: [WORKER_ENV],
      useFactory: (environment: WorkerEnvironment) =>
        new Mistral({
          apiKey: environment.MISTRAL_API_KEY,
          retryConfig: { strategy: "none" },
          timeoutMs: 120_000,
        }),
    },
    {
      provide: SCRAPER_CLIENT,
      inject: [WORKER_ENV],
      useFactory: (environment: WorkerEnvironment) =>
        new Firecrawl({
          apiKey: environment.FIRECRAWL_API_KEY,
          maxRetries: 1,
          timeoutMs: 35_000,
        }),
    },
    OcrService,
    ScraperService,
    SourceService,
    SourceProcessingService,
    SourceProcessor,
  ],
  exports: [SourceService],
})
export class SourceModule {}
