import { Module } from "@nestjs/common";
import { AdaptiveModule } from "./adaptive/adaptive.module.js";
import { AttemptsModule } from "./attempts/attempts.module.js";
import { ConfigModule } from "./config.module.js";
import { KnowledgeModule } from "./knowledge/knowledge.module.js";
import { ModulesModule } from "./modules/modules.module.js";
import { PracticeModule } from "./practice/practice.module.js";
import { SourceModule } from "./source/source.module.js";
import { SpeechModule } from "./speech/speech.module.js";

@Module({
  imports: [
    KnowledgeModule,
    ConfigModule,
    SourceModule,
    ModulesModule,
    AttemptsModule,
    AdaptiveModule,
    SpeechModule,
    PracticeModule,
  ],
})
export class AppModule {}
