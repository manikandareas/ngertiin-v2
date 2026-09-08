import { Module } from "@nestjs/common";
import { AiModule } from "../ai/ai.module.js";
import { InfrastructureModule } from "../infrastructure/infrastructure.module.js";
import { LessonImagesService } from "../modules/lesson-images.service.js";
import { AdaptiveProcessor } from "./adaptive.processor.js";
import { AdaptiveService } from "./adaptive.service.js";

@Module({
  imports: [AiModule, InfrastructureModule],
  providers: [LessonImagesService, AdaptiveService, AdaptiveProcessor],
})
export class AdaptiveModule {}
