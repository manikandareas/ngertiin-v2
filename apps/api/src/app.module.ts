import { Module } from "@nestjs/common";
import { ConfigModule } from "./config.module.js";
import { HealthModule } from "./health/health.module.js";
import { UsersModule } from "./users/users.module.js";

@Module({
  imports: [ConfigModule, HealthModule, UsersModule],
})
export class AppModule {}
