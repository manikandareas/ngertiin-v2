import { Module } from "@nestjs/common";
import { AiModule } from "../ai/ai.module.js";
import { InfrastructureModule } from "../infrastructure/infrastructure.module.js";
import { AttemptEvaluationProcessor } from "./attempt-evaluation.processor.js";
import { AttemptEvaluationService } from "./attempt-evaluation.service.js";

@Module({
  imports: [AiModule, InfrastructureModule],
  providers: [AttemptEvaluationService, AttemptEvaluationProcessor],
})
export class AttemptsModule {}
