import { Mistral } from "@mistralai/mistralai";
import { Module } from "@nestjs/common";
import type { WorkerEnvironment } from "@ngertiin/contracts/environment";
import { AiModule } from "../ai/ai.module.js";
import { WORKER_ENV } from "../config.js";
import { InfrastructureModule } from "../infrastructure/infrastructure.module.js";
import { OCR_CLIENT } from "../ocr/ocr.service.js";
import { PracticeEvaluationProcessor } from "./practice-evaluation.processor.js";
import { PracticeGenerationProcessor } from "./practice-generation.processor.js";

@Module({
  imports: [AiModule, InfrastructureModule],
  providers: [
    {
      provide: OCR_CLIENT,
      inject: [WORKER_ENV],
      useFactory: (environment: WorkerEnvironment) =>
        new Mistral({ apiKey: environment.MISTRAL_API_KEY, timeoutMs: 120_000 }),
    },
    PracticeGenerationProcessor,
    PracticeEvaluationProcessor,
  ],
})
export class PracticeModule {}
