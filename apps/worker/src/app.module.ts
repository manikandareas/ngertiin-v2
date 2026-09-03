import { Module } from "@nestjs/common";
import { ConfigModule } from "./config.module.js";
import { InfrastructureModule } from "./infrastructure/infrastructure.module.js";

@Module({
  imports: [ConfigModule, InfrastructureModule],
})
export class AppModule {}
