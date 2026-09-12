import { Module } from "@nestjs/common";
import { AiModule } from "../ai/ai.module.js";
import { InfrastructureModule } from "../infrastructure/infrastructure.module.js";
import { KnowledgeProcessor } from "./knowledge.processor.js";
import { KnowledgeService } from "./knowledge.service.js";
@Module({
  imports: [AiModule, InfrastructureModule],
  providers: [KnowledgeService, KnowledgeProcessor],
})
export class KnowledgeModule {}
