import { Module } from "@nestjs/common";
import { AiModule } from "../ai/ai.module.js";
import { InfrastructureModule } from "../infrastructure/infrastructure.module.js";
import { AdaptiveProcessor } from "./adaptive.processor.js";
import { AdaptiveService } from "./adaptive.service.js";

@Module({
  imports: [AiModule, InfrastructureModule],
  providers: [AdaptiveService, AdaptiveProcessor],
})
export class AdaptiveModule {}
