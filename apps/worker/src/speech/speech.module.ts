import { Module } from "@nestjs/common";
import { InfrastructureModule } from "../infrastructure/infrastructure.module.js";
import { SpeechProcessor } from "./speech.processor.js";

@Module({ imports: [InfrastructureModule], providers: [SpeechProcessor] })
export class SpeechModule {}
