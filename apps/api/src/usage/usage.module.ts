import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { InfrastructureModule } from "../infrastructure/infrastructure.module.js";
import { UsageController } from "./usage.controller.js";
import { UsageService } from "./usage.service.js";

@Module({
  imports: [AuthModule, InfrastructureModule],
  controllers: [UsageController],
  providers: [UsageService],
  exports: [UsageService],
})
export class UsageModule {}
