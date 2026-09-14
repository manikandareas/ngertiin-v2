import { Module } from "@nestjs/common";
import { AdaptiveModule } from "./adaptive/adaptive.module.js";
import { AttemptsModule } from "./attempts/attempts.module.js";
import { ConfigModule } from "./config.module.js";
import { KnowledgeModule } from "./knowledge/knowledge.module.js";
import { ModulesModule } from "./modules/modules.module.js";
import { SourceModule } from "./source/source.module.js";

@Module({
  imports: [
    KnowledgeModule,
    ConfigModule,
    SourceModule,
    ModulesModule,
    AttemptsModule,
    AdaptiveModule,
  ],
})
export class AppModule {}
