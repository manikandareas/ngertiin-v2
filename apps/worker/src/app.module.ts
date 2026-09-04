import { Module } from "@nestjs/common";
import { ConfigModule } from "./config.module.js";
import { ModulesModule } from "./modules/modules.module.js";

@Module({
  imports: [ConfigModule, ModulesModule],
})
export class AppModule {}
