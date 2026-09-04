import { Module } from "@nestjs/common";
import { ConfigModule } from "./config.module.js";
import { AttemptsModule } from "./attempts/attempts.module.js";
import { ModulesModule } from "./modules/modules.module.js";
import { SourceModule } from "./source/source.module.js";

@Module({
  imports: [ConfigModule, SourceModule, ModulesModule, AttemptsModule],
})
export class AppModule {}
