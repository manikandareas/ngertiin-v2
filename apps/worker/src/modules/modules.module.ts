import { Module } from "@nestjs/common";
import { AiModule } from "../ai/ai.module.js";
import { InfrastructureModule } from "../infrastructure/infrastructure.module.js";
import { SourceModule } from "../source/source.module.js";
import { ModulesProcessor } from "./modules.processor.js";
import { ModulesService } from "./modules.service.js";
import { ModulesWorkflow } from "./modules.workflow.js";

@Module({
  imports: [AiModule, InfrastructureModule, SourceModule],
  providers: [ModulesService, ModulesWorkflow, ModulesProcessor],
})
export class ModulesModule {}
