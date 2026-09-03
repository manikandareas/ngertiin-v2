import { Module } from "@nestjs/common";
import { AuthModule } from "./auth/auth.module.js";
import { ConfigModule } from "./config.module.js";
import { HealthModule } from "./health/health.module.js";

@Module({
  imports: [ConfigModule, AuthModule, HealthModule],
})
export class AppModule {}
