import { Module } from "@nestjs/common";
import { InfrastructureModule } from "../infrastructure/infrastructure.module.js";
import { SpeechAssetsService } from "./speech-assets.service.js";

@Module({
  imports: [InfrastructureModule],
  providers: [SpeechAssetsService],
  exports: [SpeechAssetsService],
})
export class SpeechModule {}
