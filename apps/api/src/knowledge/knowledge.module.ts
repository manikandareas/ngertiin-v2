import { Module } from "@nestjs/common";
import { AiModule } from "../ai/ai.module.js";
import { InfrastructureModule } from "../infrastructure/infrastructure.module.js";
import { ModulesModule } from "../modules/modules.module.js";
import { KnowledgeService } from "./knowledge.service.js";
@Module({
  imports: [ModulesModule, AiModule, InfrastructureModule],
  providers: [KnowledgeService],
  exports: [KnowledgeService],
})
export class KnowledgeModule {}
